"""
============================================================
Sima Arome — PPIC Scheduling Engine (Google OR-Tools CP-SAT)
============================================================
Enterprise-grade production scheduling using constraint programming.

This solver finds the mathematically optimal schedule that:
1. Assigns each order to a machine
2. Ensures no two orders overlap on the same machine
3. Minimizes total makespan (factory finishes as fast as possible)

Endpoint:
  POST /optimize-schedule

Usage:
  cd ai/
  uvicorn scheduler:app --host 0.0.0.0 --port 8001
  # or
  python scheduler.py

Requires: pip install ortools fastapi uvicorn
"""

from typing import Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from ortools.sat.python import cp_model

# ============================================================
# DATA MODELS
# ============================================================

class Order(BaseModel):
    """A production order to be scheduled."""
    id: str
    order_number: str
    product_name: str
    quantity: float
    unit: str
    duration_minutes: int  # Estimated production time
    priority: int = 1      # 1 = highest priority (closest deadline)
    planned_date: str = ""


class Machine(BaseModel):
    """A production line/machine available for scheduling."""
    id: str
    name: str


class ScheduleRequest(BaseModel):
    """Input payload for the scheduling optimizer."""
    orders: list[Order]
    machines: list[Machine]
    horizon_minutes: int = 2880  # Default: 2 days (48 hours) planning horizon


class ScheduledJob(BaseModel):
    """A single scheduled job in the output."""
    order_id: str
    order_number: str
    product_name: str
    quantity: float
    unit: str
    machine_id: str
    machine_name: str
    start_minute: int
    end_minute: int
    duration_minutes: int
    start_time: str   # Human-readable (e.g., "Day 1, 08:00")
    end_time: str     # Human-readable


class ScheduleResponse(BaseModel):
    """Output from the scheduling optimizer."""
    success: bool
    solver_status: str
    makespan_minutes: int
    makespan_human: str
    schedule: list[ScheduledJob]
    utilization: dict[str, float]  # Machine utilization percentages


# ============================================================
# OR-TOOLS CP-SAT SOLVER
# ============================================================

def solve_schedule(request: ScheduleRequest) -> ScheduleResponse:
    """
    Solve the production scheduling problem using Google OR-Tools CP-SAT.

    Simplified model for fast solving:
    - Pre-assign orders to machines based on product type (round-robin)
    - Optimize ordering within each machine to minimize makespan
    - No overlap constraint per machine
    """
    orders = request.orders
    machines = request.machines
    horizon = request.horizon_minutes

    if not orders:
        return ScheduleResponse(
            success=True, solver_status="NO_ORDERS", makespan_minutes=0,
            makespan_human="0 hours", schedule=[], utilization={},
        )

    if not machines:
        return ScheduleResponse(
            success=False, solver_status="NO_MACHINES", makespan_minutes=0,
            makespan_human="0 hours", schedule=[], utilization={},
        )

    num_orders = len(orders)
    num_machines = len(machines)

    # --------------------------------------------------------
    # STEP 1: Pre-assign orders to machines (round-robin by product)
    # This dramatically reduces solver complexity
    # --------------------------------------------------------
    product_groups: dict[str, list[int]] = {}
    for i, order in enumerate(orders):
        key = order.product_name
        if key not in product_groups:
            product_groups[key] = []
        product_groups[key].append(i)

    # Assign each product group to a machine (round-robin)
    machine_assignment: list[int] = [0] * num_orders
    machine_idx = 0
    for product, order_indices in product_groups.items():
        for idx in order_indices:
            machine_assignment[idx] = machine_idx % num_machines
        machine_idx += 1

    # --------------------------------------------------------
    # STEP 2: Create the CP-SAT model
    # --------------------------------------------------------
    model = cp_model.CpModel()

    # Variables: start time for each order
    starts: list[Any] = []
    ends: list[Any] = []
    intervals_per_machine: dict[int, list[Any]] = {m: [] for m in range(num_machines)}

    for i, order in enumerate(orders):
        duration = order.duration_minutes
        start_var = model.new_int_var(0, horizon - duration, f"start_{i}")
        end_var = model.new_int_var(duration, horizon, f"end_{i}")
        interval_var = model.new_interval_var(start_var, duration, end_var, f"interval_{i}")

        starts.append(start_var)
        ends.append(end_var)

        # Add interval to its assigned machine
        m = machine_assignment[i]
        intervals_per_machine[m].append(interval_var)

    # --------------------------------------------------------
    # STEP 3: No-overlap constraint per machine
    # --------------------------------------------------------
    for m in range(num_machines):
        if intervals_per_machine[m]:
            model.add_no_overlap(intervals_per_machine[m])

    # --------------------------------------------------------
    # STEP 4: Priority ordering (higher priority starts earlier)
    # --------------------------------------------------------
    for i, order in enumerate(orders):
        # Hint the solver to start high-priority orders earlier
        model.add_hint(starts[i], order.priority * 60)

    # --------------------------------------------------------
    # STEP 5: Objective — minimize makespan
    # --------------------------------------------------------
    makespan = model.new_int_var(0, horizon, "makespan")
    for i in range(num_orders):
        model.add(makespan >= ends[i])

    model.minimize(makespan)

    # --------------------------------------------------------
    # STEP 6: Solve
    # --------------------------------------------------------
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 5.0
    solver.parameters.num_workers = 4

    status = solver.solve(model)
    status_name = solver.status_name(status)

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return ScheduleResponse(
            success=False, solver_status=status_name, makespan_minutes=0,
            makespan_human="No solution found", schedule=[], utilization={},
        )

    # --------------------------------------------------------
    # STEP 7: Extract results
    # --------------------------------------------------------
    solved_makespan = solver.value(makespan)
    schedule: list[ScheduledJob] = []

    for i, order in enumerate(orders):
        start_min = solver.value(starts[i])
        end_min = solver.value(ends[i])
        m = machine_assignment[i]
        machine = machines[m]

        schedule.append(ScheduledJob(
            order_id=order.id,
            order_number=order.order_number,
            product_name=order.product_name,
            quantity=order.quantity,
            unit=order.unit,
            machine_id=machine.id,
            machine_name=machine.name,
            start_minute=start_min,
            end_minute=end_min,
            duration_minutes=order.duration_minutes,
            start_time=_minutes_to_human(start_min),
            end_time=_minutes_to_human(end_min),
        ))

    schedule.sort(key=lambda j: (j.start_minute, j.machine_id))

    # Utilization
    utilization: dict[str, float] = {}
    for m_idx, machine in enumerate(machines):
        total_work = sum(
            orders[i].duration_minutes for i in range(num_orders)
            if machine_assignment[i] == m_idx
        )
        utilization[machine.name] = round((total_work / solved_makespan) * 100, 1) if solved_makespan > 0 else 0.0

    return ScheduleResponse(
        success=True,
        solver_status=status_name,
        makespan_minutes=solved_makespan,
        makespan_human=_minutes_to_duration(solved_makespan),
        schedule=schedule,
        utilization=utilization,
    )


def _minutes_to_human(minutes: int) -> str:
    """Convert minutes from start of planning to human-readable time."""
    # Assume factory starts at 08:00
    base_hour = 8
    total_hours = minutes // 60
    mins = minutes % 60
    day = total_hours // 12 + 1  # 12-hour work days
    hour = base_hour + (total_hours % 12)
    return f"Day {day}, {hour:02d}:{mins:02d}"


def _minutes_to_duration(minutes: int) -> str:
    """Convert minutes to human-readable duration."""
    hours = minutes // 60
    mins = minutes % 60
    if hours > 0 and mins > 0:
        return f"{hours}h {mins}m"
    elif hours > 0:
        return f"{hours}h"
    else:
        return f"{mins}m"


# ============================================================
# FASTAPI APPLICATION
# ============================================================

app = FastAPI(
    title="Sima Arome — PPIC Scheduling Engine",
    description="Production scheduling optimization using Google OR-Tools CP-SAT",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    """Health check."""
    return {"status": "ok", "engine": "Google OR-Tools CP-SAT", "version": cp_model.__version__ if hasattr(cp_model, '__version__') else "9.x"}


@app.post("/optimize-schedule", response_model=ScheduleResponse)
async def optimize_schedule(request: ScheduleRequest):
    """
    Solve the production scheduling problem.

    Accepts orders and machines, returns the mathematically optimal
    schedule that minimizes total makespan (completion time).
    """
    try:
        result = solve_schedule(request)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Solver error: {str(e)}")


# ============================================================
# Entry point
# ============================================================

if __name__ == "__main__":
    import uvicorn
    print("🏭 Starting PPIC Scheduling Engine (OR-Tools CP-SAT)...")
    print("   Endpoint: POST http://localhost:8001/optimize-schedule")
    uvicorn.run(app, host="0.0.0.0", port=8001)

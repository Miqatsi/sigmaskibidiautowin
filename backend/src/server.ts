import app from './app';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`[Sima Arome] Server running on http://localhost:${PORT}`);
  console.log(`[Sima Arome] Environment: ${process.env.NODE_ENV || 'development'}`);
});

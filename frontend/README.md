# Frontend (Separate App)

This frontend is independent from Spring Boot backend.

## Backend

Run backend from project root:

```powershell
.\mvnw.cmd spring-boot:run
```

Backend API endpoint used by frontend:

- `POST http://localhost:8080/api/execute`

## Frontend

Serve this folder with Live Server (or any static server).

- Open `frontend/index.html`

Optional custom backend URL in browser console:

```js
localStorage.setItem("apiBaseUrl", "http://localhost:8080");
```

from fastapi import FastAPI

from app.routers import auth, bookings, services

app = FastAPI(title="CRM Booking API")

app.include_router(auth.router)
app.include_router(bookings.router)
app.include_router(services.router)


app.get("/")
def root():
    return {"status" : "ok"}
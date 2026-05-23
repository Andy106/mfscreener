from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
import bcrypt

from database import get_db
from models import User

router = APIRouter()


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login")
def login(credentials: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == credentials.username).first()
    if not user or not bcrypt.checkpw(
        credentials.password.encode(), user.password_hash.encode()
    ):
        raise HTTPException(status_code=401, detail="Login Failed")
    return {"message": "Login Successful"}

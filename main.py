from fastapi import FastAPI
from pydantic import BaseModel
import pandas as pd
import joblib
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware

ml_model = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
    ml_model['model'] = joblib.load('credit_risk_model.pkl')
    ml_model['threshold'] = joblib.load('best_threshold.pkl')

    yield

    ml_model.clear()

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)


class LoanApplication(BaseModel):
    person_age : int
    person_income : float
    person_home_ownership: str
    person_emp_length: float
    loan_intent: str
    loan_grade: str
    loan_amnt: float
    loan_int_rate: float
    loan_percent_income:float
    cb_person_default_on_file:str
    cb_person_cred_hist_length:int



@app.get("/")
def greet():
    return {"message": "Hello, World!"}


@app.post('/predict')
def predict_loan_approval(data : LoanApplication):
    input_df = pd.DataFrame([data.model_dump()])

    probability = ml_model['model'].predict_proba(input_df)[:,1][0]

    prediction = int(probability >= ml_model["threshold"])

    return {
        "default_probability": probability,
        "default_prediction": prediction,
        "threshold": ml_model["threshold"],
        "Result":"High Risk" if prediction == 1 else "Low Risk"
    }
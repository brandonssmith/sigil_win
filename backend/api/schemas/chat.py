from typing import Optional, List, Dict
from pydantic import BaseModel, Field, validator

class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    response: str

class ChatRequestV2(BaseModel):
    mode: str = Field(..., description="Generation mode: 'instruction' or 'chat'.")
    message: Optional[str] = Field(None, description="Single user message for 'instruction' mode.")
    messages: Optional[List[Message]] = Field(None, description="List of messages for 'chat' mode.")
    return_prompt: Optional[bool] = Field(False, description="If true, return the raw prompt string used for generation.")

    @validator('mode')
    def validate_mode(cls, v):
        if v not in ["instruction", "chat"]:
            raise ValueError("Mode must be either 'instruction' or 'chat'.")
        return v

    @validator('messages', always=True)
    def check_messages_for_chat_mode(cls, v, values):
        if values.get('mode') == 'chat' and not v:
            raise ValueError("Messages list cannot be empty in 'chat' mode.")
        return v

    @validator('message', always=True)
    def check_message_for_instruction_mode(cls, v, values):
        if values.get('mode') == 'instruction' and not v:
            raise ValueError("Message cannot be empty in 'instruction' mode.")
        return v

class ChatResponseV2(BaseModel):
    response: str
    raw_prompt: Optional[str] = None 
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator
from pydantic_core.core_schema import ValidationInfo

class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    response: str

class MessageV2(BaseModel):
    role: str = Field(..., pattern="^(user|assistant|system)$")
    content: str

class ChatRequestV2(BaseModel):
    mode: str = Field(..., pattern="^(instruction|chat)$")
    message: Optional[str] = None
    messages: Optional[List[MessageV2]] = None
    thread_id: Optional[str] = None
    return_prompt: Optional[bool] = False

    @field_validator('message', mode='before')
    @classmethod
    def check_message_in_instruction_mode(cls, v: Optional[str], info: ValidationInfo):
        if info.data.get('mode') == 'instruction' and (v is None or not str(v).strip()):
            raise ValueError("Field 'message' cannot be empty or whitespace in 'instruction' mode")
        return v

    @field_validator('messages', mode='before')
    @classmethod
    def check_messages_in_chat_mode(cls, v: Optional[List[Any]], info: ValidationInfo):
        if info.data.get('mode') == 'chat':
            if v is None or not isinstance(v, list) or not v:
                raise ValueError("Field 'messages' must be a non-empty list in 'chat' mode")
        return v

    @field_validator('message', mode='before')
    @classmethod
    def check_message_not_in_chat_mode(cls, v: Optional[str], info: ValidationInfo):
        if info.data.get('mode') == 'chat' and v is not None:
            raise ValueError("Field 'message' should not be provided in 'chat' mode")
        return v

    @field_validator('messages', mode='before')
    @classmethod
    def check_messages_not_in_instruction_mode(cls, v: Optional[List[Any]], info: ValidationInfo):
        if info.data.get('mode') == 'instruction' and v is not None:
            raise ValueError("Field 'messages' should not be provided in 'instruction' mode")
        return v

class ChatResponseV2(BaseModel):
    response: str
    thread_id: Optional[str] = None
    raw_prompt: Optional[str] = None
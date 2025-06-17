from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import shutil
from typing import List, Optional, Dict # Agregado Dict

# Importaciones para Pydub
from pydub import AudioSegment
from pydub.exceptions import CouldntDecodeError

# Importar servicios
from app.services.transcription_service import transcribe_audio, load_model as load_whisper_model
from app.services.spacy_service import process_text_to_minute, load_spacy_model

# --- Pydantic Models (sin cambios) ---
class UploadResponse(BaseModel):
    message: str
    file_id: Optional[str] = None
    filename: Optional[str] = None

class TranscriptionRequest(BaseModel):
    file_id: str

class TranscriptionResponse(BaseModel):
    file_id: str
    raw_transcription: str
    processed_file_id: Optional[str] = None

class ProcessRequest(BaseModel): # Este modelo ya estaba bien
    file_id: str # Identificador del archivo original o procesado
    raw_transcription: str # Transcripción cruda para procesar
    prompts: Optional[Dict] = None # Para pasar configuraciones/prompts al servicio Spacy

class ProcessResponse(BaseModel): # Este modelo ya estaba bien
    file_id: str
    professional_minute: str
    summary: str
    participants: List[str]

# --- FastAPI App Instance (sin cambios) ---
app = FastAPI(
    title="API de Transcripción y Generación de Minutas",
    description="API para cargar audio, transcribir y generar minutas profesionales.",
    version="0.1.0"
)

# --- Evento de Startup para cargar modelos ---
@app.on_event("startup")
async def startup_event():
    print("Iniciando la aplicación FastAPI...")
    try:
        print("Cargando modelo Whisper...")
        load_whisper_model()
        print("Modelo Whisper cargado.")

        print("Cargando modelo Spacy...")
        load_spacy_model()
        print("Modelo Spacy cargado.")

        print("Todos los modelos cargados exitosamente durante el inicio.")
    except Exception as e:
        print(f"Error cargando modelos durante el inicio: {e}")
        # Considerar si la app debe fallar si los modelos no cargan.

# --- CORS Middleware (sin cambios) ---
origins = [
    "http://localhost", "http://localhost:8000", "http://localhost:5500",
    "http://127.0.0.1", "http://127.0.0.1:8000", "http://127.0.0.1:5500",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

# --- Environment Variables & Configuration (sin cambios) ---
UPLOAD_DIRECTORY = os.getenv("STORAGE_PATH", "./uploads")
if not os.path.exists(UPLOAD_DIRECTORY):
    os.makedirs(UPLOAD_DIRECTORY)

# --- API Endpoints ---

@app.get("/")
async def read_root():
    return {"message": "Bienvenido a la API de Transcripción y Minutas"}

# Endpoint /upload (sin cambios)
@app.post("/upload", response_model=UploadResponse)
async def upload_audio_file(file: UploadFile = File(...)):
    if not file.content_type.startswith("audio/"):
        raise HTTPException(status_code=400, detail="Tipo de archivo no soportado.")
    allowed_extensions = {".wav", ".mp3", ".ogg"}
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail=f"Extensión no soportada: {file_ext}.")
    file_id = file.filename
    file_path = os.path.join(UPLOAD_DIRECTORY, file_id)
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"No se pudo guardar: {e}")
    finally:
        file.file.close()
    return {"message": "Cargado exitosamente", "file_id": file_id, "filename": file.filename}

# Endpoint /transcribe (sin cambios respecto a la última versión)
@app.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe_audio_endpoint(request_data: TranscriptionRequest):
    file_id = request_data.file_id
    original_file_path = os.path.join(UPLOAD_DIRECTORY, file_id)
    if not os.path.exists(original_file_path):
        raise HTTPException(status_code=404, detail=f"Original no encontrado: {file_id}")

    processed_file_id_wav = f"processed_{os.path.splitext(file_id)[0]}.wav"
    processed_file_path_wav = os.path.join(UPLOAD_DIRECTORY, processed_file_id_wav)
    try:
        audio = AudioSegment.from_file(original_file_path)
        normalized_audio = audio.normalize()
        normalized_audio.export(processed_file_path_wav, format="wav")
    except CouldntDecodeError:
        raise HTTPException(status_code=415, detail=f"No se pudo decodificar: {file_id}.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en preprocesamiento: {e}")

    try:
        raw_transcription = await transcribe_audio(processed_file_path_wav)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Procesado no encontrado: {processed_file_id_wav}")
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en transcripción: {e}")
    return {"file_id": file_id, "processed_file_id": processed_file_id_wav, "raw_transcription": raw_transcription}

# Endpoint /process (ACTUALIZADO)
@app.post("/process", response_model=ProcessResponse)
async def process_text_to_minute_endpoint(request_data: ProcessRequest): # Renombrado para claridad
    file_id = request_data.file_id
    raw_transcription = request_data.raw_transcription
    # prompts_from_request = request_data.prompts # Aún no tenemos prompts.py, así que pasamos None o vacío.
    # Por ahora, los prompts/configuraciones se manejarán internamente en spacy_service o serán None.
    # Cuando prompts.py esté listo, se podrá cargar y pasar aquí.

    # Cargar prompts desde prompts.py (esto se hará en el siguiente paso del plan)
    # from app.prompts import get_default_prompts # Suponiendo una función en prompts.py
    # current_prompts = get_default_prompts()
    # if request_data.prompts: # Si el cliente envía prompts específicos, se podrían fusionar
    #    current_prompts.update(request_data.prompts)
    current_prompts = None # Placeholder hasta que prompts.py esté listo

    try:
        processed_data = await process_text_to_minute(raw_transcription, prompts=current_prompts)
    except RuntimeError as e: # Captura errores de carga de modelo Spacy o procesamiento
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error inesperado en el servicio de procesamiento de texto: {e}")

    return {
        "file_id": file_id,
        "professional_minute": processed_data["professional_minute"],
        "summary": processed_data["summary"],
        "participants": processed_data["participants"]
    }

# Endpoint /download (sin cambios)
@app.get("/download/{file_id}/{format}")
async def download_minute(file_id: str, format: str):
    if format.lower() == "txt":
        return {"message": f"Descarga de {file_id} en TXT (simulado)."}
    elif format.lower() == "pdf":
        return {"message": f"Descarga de {file_id} en PDF (simulado)."}
    else:
        raise HTTPException(status_code=400, detail="Formato no válido.")

```

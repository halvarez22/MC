import whisper
import os

MODEL_SIZE = "base"
model = None

def load_model():
    global model
    if model is None:
        print(f"Cargando modelo Whisper ({MODEL_SIZE})... Esto puede tardar la primera vez.")
        try:
            model = whisper.load_model(MODEL_SIZE)
            print(f"Modelo Whisper ({MODEL_SIZE}) cargado exitosamente.")
        except Exception as e:
            print(f"Error cargando el modelo Whisper: {e}")
            raise RuntimeError(f"No se pudo cargar el modelo Whisper ({MODEL_SIZE}): {e}")
    return model

async def transcribe_audio(file_path: str) -> str:
    global model
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"El archivo de audio no fue encontrado en la ruta: {file_path}")

    if model is None:
        load_model()

    if model is None:
        raise RuntimeError("El modelo Whisper no está disponible para la transcripción.")

    try:
        print(f"Transcribiendo archivo: {file_path} con el modelo {MODEL_SIZE}...")
        result = model.transcribe(file_path, language="es", fp16=False)
        transcription_text = result["text"]
        print("Transcripción completada.")
        return transcription_text.strip()
    except Exception as e:
        print(f"Error durante la transcripción con Whisper: {e}")
        raise RuntimeError(f"La transcripción del archivo {os.path.basename(file_path)} falló: {e}")

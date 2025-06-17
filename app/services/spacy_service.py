import spacy
from spacy.matcher import Matcher
import os
from typing import List, Dict, Optional

NLP_MODEL_NAME = "es_core_news_lg"
nlp = None

def load_spacy_model():
    global nlp
    if nlp is None:
        print(f"Cargando modelo Spacy ({NLP_MODEL_NAME})... Esto puede tardar la primera vez.")
        try:
            if not spacy.util.is_package(NLP_MODEL_NAME):
                print(f"Modelo {NLP_MODEL_NAME} no encontrado, intentando descargar...")
                spacy.cli.download(NLP_MODEL_NAME, False, "--quiet")
                print(f"Descarga de {NLP_MODEL_NAME} solicitada.")
            nlp = spacy.load(NLP_MODEL_NAME)
            print(f"Modelo Spacy ({NLP_MODEL_NAME}) cargado exitosamente.")
        except Exception as e:
            print(f"Error cargando el modelo Spacy '{NLP_MODEL_NAME}': {e}")
            print(f"Por favor, asegúrese de que el modelo está descargado ejecutando: python -m spacy download {NLP_MODEL_NAME}")
            raise RuntimeError(f"No se pudo cargar el modelo Spacy ({NLP_MODEL_NAME}): {e}")
    return nlp

FILLER_WORDS = {
    "bueno", "pues", "eh", "em", "este", "o sea", "digamos", "vale",
    "sabes", "entiendes", "mira", "hombre", "mujer", "tío", "tía",
    "en plan", "literal", "básicamente", "realmente", "francamente",
    "a ver", "o sea que", "es decir", "pues nada", "venga", "dale"
}

def filter_words(doc, filler_words_set):
    tokens_to_keep = []
    for token in doc:
        if token.lemma_.lower() not in filler_words_set and not token.is_punct and not token.is_space:
            tokens_to_keep.append(token.text_with_ws)
    return "".join(tokens_to_keep).strip()

def basic_summarize(doc, num_sentences=3):
    significant_words = {token.lemma_.lower() for token in doc if token.pos_ in {"NOUN", "VERB", "ADJ"}}
    sentence_scores = {}
    for sent in doc.sents:
        score = 0
        for token in sent:
            if token.lemma_.lower() in significant_words:
                score += 1
        if len(sent) > 5 and len(sent) < 100: # Evitar frases muy cortas o muy largas
             sentence_scores[sent] = score / len(sent) if len(sent) > 0 else 0
        else:
            sentence_scores[sent] = 0 # Penalizar frases fuera de rango

    sorted_sentences = sorted(sentence_scores.items(), key=lambda item: item[1], reverse=True)
    top_sentences_with_original_order = sorted(
        [s[0] for s in sorted_sentences[:num_sentences]],
        key=lambda s: s.start # Reordenar por aparición en el texto original
    )
    return " ".join([s.text.strip() for s in top_sentences_with_original_order])

def identify_participants_basic(doc):
    participants = set()
    for ent in doc.ents:
        if ent.label_ == "PER": # PER para personas en muchos modelos de Spacy
            participants.add(ent.text)
    # Podríamos añadir lógica para buscar patrones como "Participante:" si no se encuentran entidades PER.
    return list(participants) if participants else ["Participantes no identificados automáticamente"]

async def process_text_to_minute(raw_text: str, prompts: Optional[Dict] = None) -> Dict:
    global nlp
    if nlp is None:
        load_spacy_model()
    if nlp is None:
        raise RuntimeError("Modelo Spacy no disponible para procesamiento.")

    doc = nlp(raw_text)

    # Usar las palabras de relleno por defecto y añadir las que vengan en prompts
    custom_filler_words = set(prompts.get("filler_words", [])) if prompts else set()
    current_filler_words = FILLER_WORDS.union(custom_filler_words)

    # Para la minuta, podríamos usar el texto original o el filtrado.
    # Por ahora, para el cuerpo de la minuta, usamos el texto original.
    # Se podría ofrecer una opción para usar texto filtrado.
    minute_body = raw_text # O: filter_words(doc, current_filler_words)

    # Identificar participantes
    participants = identify_participants_basic(doc)
    # Si no se identifican y hay participantes por defecto en prompts, usarlos
    if prompts and "default_participants" in prompts and not participants: # O si participants es ["Participantes no identificados..."]
        participants = prompts["default_participants"]

    # Generar resumen
    num_summary_sentences = prompts.get("summary_sentences", 3) if prompts else 3
    summary = basic_summarize(doc, num_sentences=num_summary_sentences)

    # Formatear la minuta usando una plantilla (podría venir de prompts)
    minute_template = prompts.get("minute_template",
        "### Participantes\n{participants}\n\n### Puntos Clave / Discusión\n{body}\n\n### Resumen Ejecutivo\n{summary}"
    ) if prompts else "Participantes: {participants}\n\nCuerpo: {body}\n\nResumen: {summary}"

    professional_minute_str = minute_template.format(
        participants="\n".join(f"- {p}" for p in participants),
        body=minute_body, # El cuerpo de la minuta es el texto original
        summary=summary
    )

    return {
        "professional_minute": professional_minute_str,
        "summary": summary,
        "participants": participants,
        # "filtered_text": filter_words(doc, current_filler_words) # Opcional: devolver texto filtrado
    }

```

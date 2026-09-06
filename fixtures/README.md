# Fixtures INE (Spike 2.0)

Coloca aquí pares de imágenes reales para el spike A/B.

## Convención de nombres

```text
fixtures/
  ine01_frontal.jpg
  ine01_posterior.jpg
  ine02_frontal.jpg
  ine02_posterior.jpg
  ...
```

## Ground truth (opcional)

Crea `fixtures/manifest.json`:

```json
[
  {
    "id": "ine01",
    "frontal": "ine01_frontal.jpg",
    "posterior": "ine01_posterior.jpg",
    "expectCurp": "XXXX000000HDFRRR00",
    "expectName": "APELLIDO NOMBRE"
  }
]
```

## Ejecutar

```bash
# Key server-side (SSD). En Vercel: GROQ_API_KEY. Local para spike:
set GROQ_API_KEY=gsk_tu_key_real

# Una muestra
node test-groq-vision-ine.js --frontal ./fixtures/ine01_frontal.jpg --posterior ./fixtures/ine01_posterior.jpg --expect-curp "XXXX..." --expect-name "APELLIDO"

# Batch desde manifest
node test-groq-vision-ine.js --manifest ./fixtures/manifest.json
```

**No subas INEs reales a git** si contienen PII. Añade `fixtures/*.jpg` a `.gitignore` si aplica.

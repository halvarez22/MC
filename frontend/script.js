document.addEventListener('DOMContentLoaded', () => {
    const uploadForm = document.getElementById('upload-form');
    const audioFileInput = document.getElementById('audio-file');
    const progressBar = document.getElementById('progress-bar');
    const statusMessage = document.getElementById('status-message');
    const progressSection = document.getElementById('progress-section');
    const previewSection = document.getElementById('preview-section');
    const transcriptionPreview = document.getElementById('transcription-preview');
    const downloadTxtButton = document.getElementById('download-txt');
    const downloadPdfButton = document.getElementById('download-pdf');

    let currentFile = null;

    // Validate file type on selection
    audioFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const validTypes = ['audio/wav', 'audio/mpeg', 'audio/ogg']; // Corresponds to .wav, .mp3, .ogg
            if (!validTypes.includes(file.type)) {
                alert('Error: Tipo de archivo no válido. Por favor, seleccione un archivo .wav, .mp3, o .ogg.');
                audioFileInput.value = ''; // Reset file input
                currentFile = null;
                return;
            }
            // Basic size validation (e.g., 50MB limit) - can be more specific
            const maxSizeMB = 50;
            if (file.size > maxSizeMB * 1024 * 1024) {
                alert(`Error: El archivo es demasiado grande. El tamaño máximo es de ${maxSizeMB}MB.`);
                audioFileInput.value = ''; // Reset file input
                currentFile = null;
                return;
            }
            currentFile = file;
            statusMessage.textContent = `Archivo "${file.name}" listo para cargar.`;
            audioFileInput.classList.remove('is-invalid');
        }
    });

    uploadForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!currentFile) {
            alert('Por favor, seleccione un archivo de audio válido primero.');
            audioFileInput.classList.add('is-invalid');
            return;
        }

        // Show progress section
        progressSection.style.display = 'block';
        previewSection.style.display = 'none'; // Hide previous results
        transcriptionPreview.value = '';
        downloadTxtButton.disabled = true;
        downloadPdfButton.disabled = true;

        // --- Simulate Upload and Processing ---
        statusMessage.textContent = `Cargando ${currentFile.name}...`;
        updateProgressBar(0);

        // Simulate file upload progress
        for (let percent = 0; percent <= 100; percent += 10) {
            await new Promise(resolve => setTimeout(resolve, 100)); // Simulate delay
            updateProgressBar(percent);
        }
        statusMessage.textContent = 'Carga completa. Transcribiendo y procesando...';

        // Simulate transcription and processing delay
        await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate delay

        // --- Mocked successful response ---
        statusMessage.textContent = 'Procesamiento completado.';
        transcriptionPreview.value = `Esto es una transcripción y minuta de ejemplo para el archivo: ${currentFile.name}\n\nParticipantes:\n- Juan Pérez (Gerente de Proyecto)\n- María López (Desarrolladora Principal)\n\nPuntos Clave:\n1. Discusión sobre el avance del Sprint 3.\n2. Revisión de bloqueos y posibles soluciones.\n3. Próximos pasos para la demo al cliente.`;
        previewSection.style.display = 'block';
        downloadTxtButton.disabled = false;
        downloadPdfButton.disabled = false;
        // Reset file input for next upload if desired, or allow re-processing same file
        // currentFile = null;
        // audioFileInput.value = '';
    });

    function updateProgressBar(percent) {
        progressBar.style.width = percent + '%';
        progressBar.textContent = percent + '%';
        progressBar.setAttribute('aria-valuenow', percent);
    }

    downloadTxtButton.addEventListener('click', () => {
        if (transcriptionPreview.value) {
            const blob = new Blob([transcriptionPreview.value], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = (currentFile ? currentFile.name.split('.')[0] : 'minuta') + '.txt';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            statusMessage.textContent = 'Minuta en .txt descargada.';
        }
    });

    downloadPdfButton.addEventListener('click', () => {
        // PDF generation will be handled by the backend.
        // This button would typically trigger a call to a backend endpoint.
        // For now, we can simulate or show a message.
        if (transcriptionPreview.value) {
            alert('La descarga de PDF se implementará conectando con el backend.');
            // Placeholder: could generate a simple text PDF on client-side for demo if needed,
            // but ReportLab on backend is the requirement.
            statusMessage.textContent = 'La funcionalidad de descarga PDF está pendiente de la integración con el backend.';
        }
    });

});

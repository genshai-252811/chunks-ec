// Deepgram types for transcription results

export interface DeepgramWord {
    word: string;
    start: number;
    end: number;
    confidence: number;
}

export interface DeepgramTranscription {
    transcript: string;
    words: DeepgramWord[];
    confidence: number;
    duration: number;
}

/**
 * Transcribe audio using Deepgram API
 * @param audioBlob - Audio blob to transcribe
 * @returns Transcription with word-level details
 */
export async function transcribeAudio(
    audioBlob: Blob
): Promise<DeepgramTranscription> {
    // Get Supabase URL from environment
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    if (!supabaseUrl) {
        throw new Error('Supabase URL not configured. Please add VITE_SUPABASE_URL to .env file.');
    }

    try {
        console.log('🎙️ [Deepgram] Starting transcription via Supabase Edge Function...');

        // Convert blob to ArrayBuffer
        const arrayBuffer = await audioBlob.arrayBuffer();

        // Call Supabase Edge Function
        const functionUrl = `${supabaseUrl}/functions/v1/transcribe`;

        console.log(`📡 [Deepgram] Calling Edge Function: ${functionUrl}`);

        const response = await fetch(functionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/octet-stream',
            },
            body: arrayBuffer,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            console.error('❌ [Deepgram] Edge Function error:', errorData);
            throw new Error(`Edge Function error: ${errorData.error || response.statusText}`);
        }

        const result = await response.json();

        if (!result.transcript && !result.words) {
            throw new Error('No transcription results returned from Edge Function');
        }

        const transcript = result.transcript || '';
        const words = result.words || [];
        const confidence = result.confidence || 0;
        const duration = result.duration || 0;

        console.log(`✅ [Deepgram] Transcription complete: ${words.length} words, ${duration.toFixed(2)}s`);
        console.log(`📝 [Deepgram] Transcript: "${transcript.substring(0, 100)}${transcript.length > 100 ? '...' : ''}"`);

        return {
            transcript,
            words: words.map((w: any) => ({
                word: w.word,
                start: w.start,
                end: w.end,
                confidence: w.confidence,
            })),
            confidence,
            duration,
        };
    } catch (error) {
        console.error('❌ [Deepgram] Transcription failed:', error);
        throw error;
    }
}

/**
 * Calculate words per minute from Deepgram transcription
 * @param transcription - Deepgram transcription result
 * @returns Words per minute
 */
export function calculateWPMFromTranscription(
    transcription: DeepgramTranscription
): number {
    const wordCount = transcription.words.length;
    const durationMinutes = transcription.duration / 60;

    if (durationMinutes === 0) {
        return 0;
    }

    return Math.round(wordCount / durationMinutes);
}

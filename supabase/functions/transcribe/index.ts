import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@deepgram/sdk@3.4.0'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Get Deepgram API key from environment
        const deepgramApiKey = Deno.env.get('DEEPGRAM_API_KEY')

        if (!deepgramApiKey) {
            throw new Error('DEEPGRAM_API_KEY not configured in Supabase Edge Function secrets')
        }

        // Get audio data from request
        const arrayBuffer = await req.arrayBuffer()

        if (!arrayBuffer || arrayBuffer.byteLength === 0) {
            return new Response(
                JSON.stringify({ error: 'No audio data provided' }),
                {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                }
            )
        }

        console.log(`📥 Received audio data: ${arrayBuffer.byteLength} bytes`)

        // Initialize Deepgram client
        const deepgram = createClient(deepgramApiKey)

        // Transcribe audio
        console.log('🎙️ Starting Deepgram transcription...')
        const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
            arrayBuffer,
            {
                model: 'nova-2',
                smart_format: true,
                punctuate: true,
                utterances: true,
                diarize: false,
            }
        )

        if (error) {
            console.error('❌ Deepgram API error:', error)
            return new Response(
                JSON.stringify({ error: `Deepgram API error: ${error.message}` }),
                {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                }
            )
        }

        if (!result?.results?.channels?.[0]?.alternatives?.[0]) {
            console.warn('⚠️ No transcription results')
            return new Response(
                JSON.stringify({ error: 'No transcription results' }),
                {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                }
            )
        }

        const alternative = result.results.channels[0].alternatives[0]
        const transcript = alternative.transcript || ''
        const words = alternative.words || []
        const confidence = alternative.confidence || 0
        const duration = result.metadata?.duration || 0

        console.log(`✅ Transcription complete: ${words.length} words, ${duration.toFixed(2)}s`)
        console.log(`📝 Transcript: "${transcript}"`)

        // Return transcription data
        return new Response(
            JSON.stringify({
                transcript,
                words,
                confidence,
                duration,
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        )

    } catch (error) {
        console.error('❌ Error in transcribe function:', error)
        return new Response(
            JSON.stringify({
                error: error.message || 'Internal server error',
                details: error.toString()
            }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        )
    }
})

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const deepgramApiKey = Deno.env.get('DEEPGRAM_API_KEY')
        if (!deepgramApiKey) {
            throw new Error('DEEPGRAM_API_KEY not configured')
        }

        const arrayBuffer = await req.arrayBuffer()
        if (!arrayBuffer || arrayBuffer.byteLength === 0) {
            return new Response(
                JSON.stringify({ error: 'No audio data provided' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        console.log(`📥 Received audio data: ${arrayBuffer.byteLength} bytes`)

        // Call Deepgram REST API directly (more reliable than SDK in Deno)
        const deepgramUrl = 'https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&punctuate=true&utterances=true'

        console.log('🎙️ Calling Deepgram API...')
        const response = await fetch(deepgramUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Token ${deepgramApiKey}`,
                'Content-Type': 'audio/webm',
            },
            body: arrayBuffer,
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error(`❌ Deepgram API error (${response.status}):`, errorText)

            if (response.status === 410) {
                throw new Error('Deepgram model deprecated. Check docs for current models.')
            }
            if (response.status === 401 || response.status === 403) {
                throw new Error('Deepgram API key invalid or expired.')
            }

            throw new Error(`Deepgram API error ${response.status}: ${errorText}`)
        }

        const result = await response.json()

        const alternative = result?.results?.channels?.[0]?.alternatives?.[0]
        if (!alternative) {
            console.warn('⚠️ No transcription results from Deepgram')
            return new Response(
                JSON.stringify({ transcript: '', words: [], confidence: 0, duration: 0 }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const transcript = alternative.transcript || ''
        const words = alternative.words || []
        const confidence = alternative.confidence || 0
        const duration = result.metadata?.duration || 0

        console.log(`✅ Transcription: ${words.length} words, ${duration.toFixed(2)}s — "${transcript.substring(0, 80)}"`)

        return new Response(
            JSON.stringify({ transcript, words, confidence, duration }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('❌ Transcribe error:', error)
        return new Response(
            JSON.stringify({
                error: (error as Error).message || 'Internal server error',
                details: String(error),
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
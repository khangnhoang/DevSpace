import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

async function getLessons(){ 
    const {data, error} = await supabase
    .from('lessons')
    .select('id, title, slug');

    if(error){
        return {error};
    }

    return {data};
}
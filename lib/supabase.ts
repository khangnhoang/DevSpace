import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

export async function getLessons(){ 
    const {data, error} = await supabase
    .from('lessons')
    .select('id, title, slug')
    .order('id', {ascending: true});

    if(error){
        return {error};
    }

    return {data};
}

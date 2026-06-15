const { createClient } = require('@supabase/supabase-js');

let client = null;

if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
  client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
} else {
  console.warn('Supabase not configured — caching disabled. Set SUPABASE_URL and SUPABASE_SERVICE_KEY.');
}

module.exports = client;

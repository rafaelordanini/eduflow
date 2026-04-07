const { createClient } = require('@supabase/supabase-js');

let _client = null;

function getSupabase() {
    if (!_client) {
        var url = process.env.SUPABASE_URL;
        var key = process.env.SUPABASE_SERVICE_KEY;
        if (!url || !key) {
            throw new Error(
                'Variáveis de ambiente não configuradas. ' +
                (!url ? 'SUPABASE_URL está vazia. ' : '') +
                (!key ? 'SUPABASE_SERVICE_KEY está vazia.' : '')
            );
        }
        _client = createClient(url, key);
    }
    return _client;
}

module.exports = { getSupabase };

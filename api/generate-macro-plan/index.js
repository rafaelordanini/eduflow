const { getSupabase } = require('../../lib/supabase');
const { cors, requireAuth } = require('../../lib/middleware');

const CACD_DATA = {
  totalTopicos: 473,
  materias: [
    {
      nome: 'História do Brasil',
      totalTopicos: 79,
      prioridade: 1,
      leituras: 'Fausto HB caps.1-11; Linhares HGB caps.1-10; Schwarcz&Starling caps.1-4; Ricupero Diplomacia Partes I-V; Doratioto Maldita Guerra; Cervo HPEB caps.3,10,13-14; Gerson Moura Autonomia na Dependência; Angela Alonso Flores votos e balas',
      blocos: [
        { bloco: 'Brasil Pré-Colonial e Colonização', rec: 'Alta', semanas: [1,2], leituras: 'Fausto HB cap.1; Linhares HGB caps.1-2; Schwarcz&Starling caps.1-4' },
        { bloco: 'Ciclo do Ouro e Reformas Pombalinas', rec: 'Média', semanas: [3], leituras: 'Ricupero Diplomacia Partes II-III' },
        { bloco: 'Período Joanino e Independência', rec: 'Alta', semanas: [4], leituras: 'Fausto HB cap.3; Linhares HGB cap.6; Ricupero Parte III' },
        { bloco: 'Primeiro Reinado e Regências', rec: 'Alta', semanas: [5], leituras: 'Fausto HB cap.4; Doratioto História RI cap.1' },
        { bloco: 'Segundo Reinado (Parte 1)', rec: 'Alta', semanas: [6,7], leituras: 'Fausto HB cap.5; Ricupero Parte V; Cervo HPEB cap.3' },
        { bloco: 'Segundo Reinado (Parte 2) e Guerra do Paraguai', rec: 'Alta', semanas: [8,9], leituras: 'Doratioto Maldita Guerra intro+cap.1' },
        { bloco: 'Crise do Império e Proclamação da República', rec: 'Alta', semanas: [10,11], leituras: 'Angela Alonso Flores votos e balas' },
        { bloco: 'República Oligárquica', rec: 'Alta', semanas: [12,13], leituras: 'Fausto HB cap.6' },
        { bloco: 'Política Externa Barão do Rio Branco', rec: 'Alta', semanas: [14], leituras: 'Ricupero Diplomacia Parte 4' },
        { bloco: 'Era Vargas (1930-1945)', rec: 'Alta', semanas: [15,16], leituras: 'Fausto HB cap.7; Cervo HPEB cap.10; Gerson Moura Autonomia na Dependência' },
        { bloco: '2ª Guerra e Pós-Guerra', rec: 'Alta', semanas: [17], leituras: 'Fausto HB cap.8; Gerson Moura Relações Exteriores Brasil' },
        { bloco: 'Regime Militar e Abertura', rec: 'Alta', semanas: [18,19,20], leituras: 'Fausto HB caps.10-11; Cervo HPEB caps.13-14' },
      ]
    },
    {
      nome: 'História Mundial',
      totalTopicos: 60,
      prioridade: 2,
      leituras: 'Hobsbawm Era das Revoluções; Hobsbawm Era do Capital; Hobsbawm Era dos Impérios; Hobsbawm Era dos Extremos; Saraiva HRI caps.1-8; Burns v.1-2 caps. principais; Gaddis The Cold War; Kissinger O Mundo Restaurado',
      blocos: [
        { bloco: 'Absolutismo, Mercantilismo, Revoluções Inglesas', rec: 'Alta', semanas: [1] },
        { bloco: 'Iluminismo e Revolução Francesa', rec: 'Alta', semanas: [2] },
        { bloco: 'Período Napoleônico e Congresso de Viena', rec: 'Alta', semanas: [3,4], leituras: 'Kissinger O Mundo Restaurado caps.9-10' },
        { bloco: 'Liberalismo e Unificações (1820-1890)', rec: 'Alta', semanas: [5,6] },
        { bloco: 'Imperialismo', rec: 'Alta', semanas: [7], leituras: 'Hobsbawm Era dos Impérios caps.1,2,3,6' },
        { bloco: 'Primeira Guerra Mundial', rec: 'Alta', semanas: [8] },
        { bloco: 'Fascismo, Comunismo e Contexto da 2ª Guerra', rec: 'Alta', semanas: [13,14] },
        { bloco: 'Segunda Guerra Mundial', rec: 'Alta', semanas: [15] },
        { bloco: 'Guerra Fria', rec: 'Alta', semanas: [16,17], leituras: 'Gaddis The Cold War: A New History' },
        { bloco: 'Descolonização e Mundo Pós-Guerra Fria', rec: 'Alta', semanas: [18,19,22] },
      ]
    },
    {
      nome: 'Português',
      totalTopicos: 54,
      prioridade: 3,
      leituras: 'Cunha & Cintra Nova Gramática do Português Contemporâneo; Bechara Moderna Gramática Portuguesa; Bosi História Concisa da Literatura Brasileira; Jakobson Linguística e Comunicação',
      blocos: [
        { bloco: 'Funções da Linguagem e Variação Linguística', rec: 'Alta', semanas: [1] },
        { bloco: 'Coesão, Coerência e Figuras de Linguagem', rec: 'Alta', semanas: [2] },
        { bloco: 'Nova Ortografia e Figuras de Sintaxe', rec: 'Alta', semanas: [3] },
        { bloco: 'Concordância Nominal e Verbal', rec: 'Alta', semanas: [4] },
        { bloco: 'Colocação Pronominal', rec: 'Alta', semanas: [5] },
        { bloco: 'Regência Verbal e Nominal', rec: 'Alta', semanas: [6] },
        { bloco: 'Produção Textual e Dissertação (TPS)', rec: 'Alta', semanas: [8] },
        { bloco: 'Literatura Brasileira: Romantismo e Realismo', rec: 'Alta', semanas: [9,10] },
        { bloco: 'Literatura Brasileira: Modernismo', rec: 'Alta', semanas: [11,12] },
      ]
    },
    {
      nome: 'Geografia',
      totalTopicos: 46,
      prioridade: 4,
      leituras: 'Magnoli Geografia caps. principais; Atlas Geográfico Escolar (IBGE); relatórios do IPCC',
      blocos: [
        { bloco: 'Conceitos fundamentais e rede urbana', rec: 'Alta', semanas: [1,2] },
        { bloco: 'Demografia mundial e brasileira', rec: 'Alta', semanas: [3,4] },
        { bloco: 'Globalização, indústria e energia', rec: 'Alta', semanas: [5,6,7] },
        { bloco: 'Geopolítica e ordenamento territorial', rec: 'Alta', semanas: [10,11] },
        { bloco: 'Biomas, recursos hídricos e meio ambiente', rec: 'Alta', semanas: [12,13] },
      ]
    },
    {
      nome: 'Política Internacional',
      totalTopicos: 53,
      prioridade: 5,
      leituras: 'Saraiva HRI caps.1-8; Herz & Hoffmann Organizações Internacionais; Cervo HPEB caps. principais',
      blocos: [
        { bloco: 'ONU e Operações de Paz', rec: 'Alta', semanas: [1,2] },
        { bloco: 'Temas globais: terrorismo, narcotráfico, nuclear', rec: 'Alta', semanas: [3,4,5] },
        { bloco: 'Política Externa Brasileira (PEB)', rec: 'Alta', semanas: [8,9,10] },
        { bloco: 'Relações bilaterais do Brasil', rec: 'Alta', semanas: [11,12] },
        { bloco: 'Integrações regionais (MERCOSUL, UE, AL)', rec: 'Alta', semanas: [13,14] },
        { bloco: 'Teorias das Relações Internacionais', rec: 'Alta', semanas: [17] },
      ]
    },
    {
      nome: 'Economia',
      totalTopicos: 46,
      prioridade: 6,
      leituras: 'Mankiw Introdução à Economia; Vasconcellos Economia Micro e Macro; Gremaud Economia Brasileira Contemporânea',
      blocos: [
        { bloco: 'Microeconomia: oferta, demanda, elasticidade', rec: 'Alta', semanas: [1,2] },
        { bloco: 'Macroeconomia: PIB, contas nacionais', rec: 'Alta', semanas: [5,6] },
        { bloco: 'Política monetária, fiscal e cambial', rec: 'Alta', semanas: [7,8,9] },
        { bloco: 'Economia brasileira: do café ao Plano Real', rec: 'Alta', semanas: [12,13,14,15] },
      ]
    },
    {
      nome: 'Direito Interno',
      totalTopicos: 59,
      prioridade: 7,
      leituras: 'Constituição Federal 1988; Di Pietro Direito Administrativo; Carvalho Filho Manual de Direito Administrativo',
      blocos: [
        { bloco: 'Teoria do Estado e Constitucionalismo', rec: 'Alta', semanas: [1,2] },
        { bloco: 'Direitos Fundamentais', rec: 'Alta', semanas: [3] },
        { bloco: 'Organização dos Poderes', rec: 'Alta', semanas: [4,5] },
        { bloco: 'Administração Pública e Atos Administrativos', rec: 'Alta', semanas: [6,7] },
        { bloco: 'Regime Jurídico do Serviço Exterior', rec: 'Alta', semanas: [9] },
      ]
    },
    {
      nome: 'Direito Internacional',
      totalTopicos: 24,
      prioridade: 8,
      leituras: 'Rezek Direito Internacional Público; Mazzuoli Curso de Direito Internacional Público; Convenção de Viena sobre Direito dos Tratados',
      blocos: [
        { bloco: 'Fundamentos e fontes do DI', rec: 'Alta', semanas: [1,2] },
        { bloco: 'Direito dos Tratados (Convenção de Viena)', rec: 'Alta', semanas: [3,4] },
        { bloco: 'Imunidades diplomáticas e consulares', rec: 'Alta', semanas: [8,9] },
        { bloco: 'DI Penal, Refugiados e DI Econômico', rec: 'Alta', semanas: [12,13,14] },
      ]
    },
    {
      nome: 'Inglês',
      totalTopicos: 29,
      prioridade: 9,
      leituras: 'Gramática Oxford Advanced Learner; Financial Times artigos recentes; The Economist artigos recentes',
      blocos: [
        { bloco: 'Compreensão e tradução de textos (TPS)', rec: 'Alta', semanas: [1,2,3] },
        { bloco: 'Gramática avançada e produção textual', rec: 'Alta', semanas: [4,5,6] },
      ]
    },
    {
      nome: 'Espanhol',
      totalTopicos: 23,
      prioridade: 10,
      leituras: 'Gramática española em uso (nível avançado); El País artigos recentes',
      blocos: [
        { bloco: 'Gramática: tempos verbais e pronomes', rec: 'Alta', semanas: [1,2,3] },
        { bloco: 'Produção textual e compreensão leitora', rec: 'Alta', semanas: [4,5,6] },
      ]
    },
    {
      nome: 'Francês',
      totalTopicos: 24,
      prioridade: 11,
      leituras: 'Bescherelle La conjugaison; Le Monde artigos recentes; Grammaire progressive du français (nível avançado)',
      blocos: [
        { bloco: 'Gramática: artigos, pronomes e tempos verbais', rec: 'Alta', semanas: [1,2,3] },
        { bloco: 'Produção textual e conectivos lógicos', rec: 'Alta', semanas: [4,5,6] },
      ]
    },
  ]
};

const OPENROUTER_MODEL = 'google/gemini-2.5-flash';

// Enrich plan: add IDs, spaced repetition review items, subject_id references, done flags
function enrichPlan(plano, subjectMap) {
  const n = (plano.semanas || []).length;
  // Tag study items
  plano.semanas.forEach((sem, wi) => {
    sem.materias = (sem.materias || []).map((m, mi) => {
      const sid = subjectMap[m.nome] || null;
      return { ...m, id: 'w' + (wi + 1) + '-m' + mi, tipo: 'estudo', done: false, subject_id: sid };
    });
  });

  // Collect study items for spaced repetition
  const studyItems = [];
  plano.semanas.forEach((sem, wi) => {
    sem.materias.forEach(m => {
      if (m.tipo === 'estudo') studyItems.push({ wi, nome: m.nome, topico: m.topico, subject_id: m.subject_id });
    });
  });

  // Track added reviews per (week, subject) to avoid duplicates
  const added = {};
  studyItems.forEach(({ wi, nome, topico, subject_id }) => {
    [1, 2, 4].forEach(function(interval) {
      const targetWi = wi + interval;
      if (targetWi >= n) return;
      const key = targetWi + ':' + nome;
      if (added[key]) return;
      // Skip if subject is being actively studied that week already
      const targetSem = plano.semanas[targetWi];
      const alreadyStudied = targetSem.materias.some(function(m) { return m.tipo === 'estudo' && m.nome === nome; });
      if (alreadyStudied) return;
      added[key] = true;
      targetSem.materias.push({
        id: 'rev-w' + (wi + 1) + '-' + nome.replace(/\s+/g, '') + '-d' + (interval * 7),
        nome: nome,
        topico: 'Revisão espaçada: ' + (topico || nome),
        tipo: 'revisao',
        done: false,
        subject_id: subject_id,
        atividades: [{ tipo: 'revisao', descricao: 'Fazer exercícios de ' + nome + ' (revisão espaçada em ' + (interval * 7) + ' dias)', horas: 1 }],
        leituras: '',
      });
    });
  });

  return plano;
}

module.exports = async function handler(req, res) {
  try {
    if (cors(req, res)) return;

    const user = requireAuth(req, res);
    if (!user) return;

    const supabase = getSupabase();

    // GET — return current plan (auto-migrate old plans that lack enrichment)
    if (req.method === 'GET') {
      const { data: mp, error } = await supabase
        .from('macro_plans')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!mp) return res.status(200).json(null);

      // Check if plan needs enrichment (old plans lack id/tipo/done on items)
      const firstItem = mp.plan_json?.semanas?.[0]?.materias?.[0];
      if (firstItem && !firstItem.id) {
        const { data: subjects } = await supabase.from('subjects').select('id, name');
        const subjectMap = {};
        (subjects || []).forEach(s => { subjectMap[s.name] = s.id; subjectMap[s.name.toLowerCase()] = s.id; });
        enrichPlan(mp.plan_json, subjectMap);
        await supabase.from('macro_plans').update({ plan_json: mp.plan_json }).eq('id', mp.id);
      }

      return res.status(200).json(mp);
    }

    // PUT — mark/unmark a plan item as done
    if (req.method === 'PUT') {
      const { itemId, done } = req.body || {};
      if (!itemId || typeof done !== 'boolean') {
        return res.status(400).json({ error: 'Informe itemId e done (boolean).' });
      }
      const { data: mp, error: fetchErr } = await supabase
        .from('macro_plans').select('id, plan_json').eq('user_id', user.id)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (fetchErr || !mp) return res.status(404).json({ error: 'Plano não encontrado.' });

      let found = false;
      (mp.plan_json.semanas || []).forEach(function(sem) {
        (sem.materias || []).forEach(function(m) {
          if (m.id === itemId) { m.done = done; found = true; }
        });
      });
      if (!found) return res.status(404).json({ error: 'Item não encontrado no plano.' });

      await supabase.from('macro_plans').update({ plan_json: mp.plan_json }).eq('id', mp.id);
      return res.status(200).json({ ok: true });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    const { dataProva, horasPorSemana, observacoes } = req.body || {};

    if (!dataProva) return res.status(400).json({ error: 'Informe a data da prova (dataProva).' });
    if (!horasPorSemana || horasPorSemana < 1) return res.status(400).json({ error: 'Informe as horas por semana (mínimo 1).' });

    const hoje = new Date();
    const prova = new Date(dataProva);
    const diffMs = prova - hoje;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const totalSemanas = Math.max(1, Math.floor(diffDays / 7));
    const totalHoras = totalSemanas * horasPorSemana;

    const materiasTexto = CACD_DATA.materias.map(m => {
      const blocos = m.blocos.map(b => `  • [${b.rec}] ${b.bloco}${b.leituras ? ': ' + b.leituras : ''}`).join('\n');
      return `**${m.nome}** (${m.totalTopicos} tópicos, prioridade ${m.prioridade}):\n${blocos}`;
    }).join('\n\n');

    const systemPrompt = `Você é o Barão — um coach de estudos especializado no CACD (Concurso de Admissão à Carreira Diplomática). Sua missão é criar um Plano Mestre de estudos, distribuindo as 11 matérias do CACD semana a semana até a data da prova.

Responda SEMPRE em JSON válido com a seguinte estrutura (sem markdown):
{
  "semanas": [
    {
      "semana": 1,
      "dataInicio": "YYYY-MM-DD",
      "dataFim": "YYYY-MM-DD",
      "materias": [
        {
          "nome": "nome da matéria",
          "topico": "tópico específico desta semana",
          "atividades": [
            { "tipo": "leitura|fichamento|tps|revisao|aula", "descricao": "descrição detalhada", "horas": 2.0 }
          ],
          "leituras": "livros e capítulos específicos para esta semana"
        }
      ]
    }
  ],
  "resumo": "resumo estratégico do plano em 3-4 frases",
  "totalSemanas": ${totalSemanas},
  "totalHoras": ${totalHoras}
}`;

    const userPrompt = `# Plano Mestre CACD

**Data da prova:** ${dataProva}
**Semanas disponíveis:** ${totalSemanas}
**Horas por semana:** ${horasPorSemana}h
**Total de horas:** ${totalHoras}h
**Data de início:** ${hoje.toISOString().split('T')[0]}
${observacoes ? `**Observações:** ${observacoes}` : ''}

## Matérias do CACD (${CACD_DATA.totalTopicos} tópicos no total):
${materiasTexto}

## Instruções:
1. Distribua as ${totalSemanas} semanas entre as 11 matérias priorizando por ordem de prioridade e recorrência em prova
2. Cada semana deve ter 2-3 matérias no máximo para permitir foco
3. Nas primeiras semanas, foque em matérias de alta prioridade (HB, HM, PT)
4. Reserve as últimas 2-3 semanas para revisão geral e simulados
5. Indique leituras ESPECÍFICAS com livro + capítulo
6. O dataInicio da semana 1 é ${hoje.toISOString().split('T')[0]}
7. Calcule dataInicio e dataFim de cada semana corretamente (7 dias por semana)
8. Retorne SOMENTE o JSON, sem markdown adicional`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://eduflow.vercel.app',
        'X-Title': 'EduFlow CACD Coach',
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(502).json({ error: 'Erro ao chamar o modelo de IA: ' + errText.substring(0, 200) });
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;
    if (!content) return res.status(502).json({ error: 'Resposta vazia do modelo de IA.' });

    let plano;
    try {
      plano = JSON.parse(content);
    } catch (e) {
      const match = content.match(/```json\n?([\s\S]+?)\n?```/) || content.match(/({[\s\S]+})/);
      if (match) plano = JSON.parse(match[1]);
      else return res.status(502).json({ error: 'Resposta do modelo não está em formato válido.' });
    }

    // Fetch subjects to build name→id map for lesson links
    const { data: subjects } = await supabase.from('subjects').select('id, name');
    const subjectMap = {};
    (subjects || []).forEach(s => {
      subjectMap[s.name] = s.id;
      // Also map common name variations
      subjectMap[s.name.toLowerCase()] = s.id;
    });

    // Enrich plan with IDs, spaced repetition items, subject_id, done flags
    enrichPlan(plano, subjectMap);

    // Persist plan (replace any existing)
    await supabase.from('macro_plans').delete().eq('user_id', user.id);
    await supabase.from('macro_plans').insert({
      user_id: user.id,
      plan_json: plano,
      data_prova: dataProva,
    });

    return res.status(200).json(plano);

  } catch (err) {
    console.error('Generate macro plan error:', err);
    return res.status(500).json({ error: 'Erro interno: ' + (err.message || 'desconhecido') });
  }
};

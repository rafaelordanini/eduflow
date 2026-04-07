/**
 * EduFlow — Script de Seed
 * Cria o usuário admin padrão e dados de exemplo.
 *
 * Uso:
 *   1. Configure as variáveis em .env
 *   2. Execute: npm run seed
 */

require('dotenv/config');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

async function seed() {
    console.log('🌱 Iniciando seed do EduFlow...\n');

    // ── 1. Usuários ──
    const users = [
        { username: 'admin',  password: 'admin123',  name: 'Administrador',   role: 'admin'   },
        { username: 'prof',   password: 'prof123',   name: 'Professor Carlos', role: 'admin'  },
        { username: 'maria',  password: 'aluno123',  name: 'Maria Silva',      role: 'student' },
        { username: 'joao',   password: 'aluno123',  name: 'João Santos',      role: 'student' },
        { username: 'ana',    password: 'aluno123',  name: 'Ana Oliveira',     role: 'student' }
    ];

    console.log('👤 Criando usuários...');
    for (const u of users) {
        const hash = await bcrypt.hash(u.password, 10);
        const { error } = await supabase
            .from('users')
            .upsert({ username: u.username, password_hash: hash, name: u.name, role: u.role },
                     { onConflict: 'username' });
        if (error) {
            console.error('   ✗ Erro ao criar ' + u.username + ':', error.message);
        } else {
            console.log('   ✓ ' + u.username + ' (' + u.role + ')');
        }
    }

    // ── 2. Matérias ──
    console.log('\n📚 Criando matérias...');
    const subjects = [
        { name: 'Fundamentos de Matemática', description: 'Aprenda os conceitos essenciais de matemática desde o básico até álgebra.' },
        { name: 'Desenvolvimento Web',       description: 'Construa aplicações web modernas com HTML, CSS e JavaScript.' },
        { name: 'Física para Iniciantes',     description: 'Explore os princípios fundamentais da física e suas aplicações.' }
    ];

    const { data: createdSubjects, error: sErr } = await supabase
        .from('subjects')
        .insert(subjects)
        .select();

    if (sErr) {
        console.error('   ✗ Erro ao criar matérias:', sErr.message);
        return;
    }
    createdSubjects.forEach(function(s) { console.log('   ✓ ' + s.name + ' (id: ' + s.id + ')'); });

    // ── 3. Aulas ──
    console.log('\n🎬 Criando aulas...');
    const sMap = {};
    createdSubjects.forEach(function(s) { sMap[s.name] = s.id; });

    const lessons = [
        { subject_id: sMap['Fundamentos de Matemática'], title: 'Introdução aos Números',   duration_minutes: 15, order_index: 1 },
        { subject_id: sMap['Fundamentos de Matemática'], title: 'Operações Fundamentais',    duration_minutes: 20, order_index: 2 },
        { subject_id: sMap['Fundamentos de Matemática'], title: 'Frações e Decimais',        duration_minutes: 25, order_index: 3 },
        { subject_id: sMap['Desenvolvimento Web'],       title: 'Estrutura do HTML',         duration_minutes: 18, order_index: 1 },
        { subject_id: sMap['Desenvolvimento Web'],       title: 'Estilização com CSS',       duration_minutes: 22, order_index: 2 },
        { subject_id: sMap['Desenvolvimento Web'],       title: 'JavaScript Básico',         duration_minutes: 30, order_index: 3 },
        { subject_id: sMap['Física para Iniciantes'],    title: 'Leis de Newton',            duration_minutes: 20, order_index: 1 },
        { subject_id: sMap['Física para Iniciantes'],    title: 'Energia e Trabalho',        duration_minutes: 25, order_index: 2 }
    ];

    const { data: createdLessons, error: lErr } = await supabase
        .from('lessons')
        .insert(lessons)
        .select();

    if (lErr) {
        console.error('   ✗ Erro ao criar aulas:', lErr.message);
        return;
    }
    createdLessons.forEach(function(l) { console.log('   ✓ ' + l.title); });

    console.log('\n✅ Seed concluído com sucesso!');
    console.log('   Acesse com: admin / admin123\n');
}

seed().catch(function(err) { console.error('Erro fatal:', err); process.exit(1); });

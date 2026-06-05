#!/usr/bin/env node
/**
 * Script de importação de aulas do Google Drive para o EduFlow.
 *
 * Pré-requisitos:
 *   SUPABASE_URL=...
 *   SUPABASE_SERVICE_KEY=...
 *
 * Uso:
 *   node scripts/import-drive-lessons.js
 *
 * O script busca as matérias pelo nome e insere as aulas associadas.
 * Execuções repetidas são seguras (ignora conflitos via ON CONFLICT DO NOTHING).
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

function driveUrl(id) {
  return `https://drive.google.com/file/d/${id}/view`;
}
function embedUrl(id) {
  return `https://drive.google.com/file/d/${id}/preview`;
}
function formatTitle(filename) {
  let name = filename.replace(/\.mp4$/i, '').replace(/^aula\d+_?/i, '').replace(/_/g, ' ').trim();
  if (!name) return filename.replace(/\.mp4$/i, '');
  return name.charAt(0).toUpperCase() + name.slice(1);
}
function aulaOrder(filename, moduleNum) {
  const m = filename.match(/^aula(\d+)/i);
  const n = m ? parseInt(m[1]) : 0;
  return (moduleNum - 1) * 100 + n;
}

// ──────────────────────────────────────────────
//  DADOS COLETADOS DO GOOGLE DRIVE
// ──────────────────────────────────────────────
const IMPORT_DATA = [
  {
    subject: 'História do Brasil',
    lessons: [
      // MÓDULO 1
      { filename: 'aula1_panorama_geral_periodo_colonial.mp4',           id: '1J3sCdTEjiX_fuHtxyV04vdGBswbrGZXn', module: 1 },
      { filename: 'aula2_O_Bandeirantismo.mp4',                          id: '18QiCcG3WTXXzi3ZqVXSDIbYdzlgH75Fx', module: 1 },
      { filename: 'aula3_monitoria1.mp4',                                id: '1A60CxbTI1FS1Ey5PHlR0yWGtpHUmuHf8', module: 1 },
      { filename: 'aula4_O_Seculo_do_Ouro.mp4',                         id: '1LxqY8HXtiAQTz-NXN21vq06PNGh95QLA', module: 1 },
      { filename: 'aula5_Alexandre_de_Gusmao_Tratado_de_Madri.mp4',     id: '1yL--3GCWU6_4gVwLDnLz9VlrDdYcVGKD', module: 1 },
      { filename: 'aula6_monitoria2.mp4',                                id: '1aSzCmRt5bRJrGza7JINuiQyPyD4puZE2', module: 1 },
      { filename: 'aula7_Periodo_Pombalino_e_Gov_Dona_Maria.mp4',       id: '1h0J8AuIo3FhaQzXf1CrqqyynxQ-hLxlT', module: 1 },
      { filename: 'aula8_periodo_joanino.mp4',                           id: '1NpOImCdDTjHe6-KRh8fY6Jj-_Ldn9reM', module: 1 },
      { filename: 'aula9_monitoria3.mp4',                                id: '19LSff5lul4Vnzg-49YY4BZXbXc0NOrmP', module: 1 },
      { filename: 'aula10_Processo_de_Independencia.mp4',               id: '1cgaG8Tyemc1itNv-GIWdgkUk14mxQAnY', module: 1 },
      { filename: 'aula11_Historiografia_Processo_Independencia.mp4',   id: '1GACNgfZaJleT9HoFIL6i5cU5a4I4Eu1u', module: 1 },
      { filename: 'aula12_monitoria4.mp4',                               id: '1f689Ik4b3q_TkLyhNQmSE599JhQRmg1F', module: 1 },
      // MÓDULO 2
      { filename: 'aula1_Primeiro_Reinado_1822_1831.mp4',               id: '1Oh7u4HdxZKqOh7sIyQAH56LpfluEalmJ', module: 2 },
      { filename: 'aula2_Regencia_1831-1840.mp4',                       id: '10ySdwFpXvAT5t3O7CvrQqDpVaSQxVYYj', module: 2 },
      { filename: 'aula3_monitoria1.mp4',                                id: '1ln8xLWMC3LcA0zIwh3boeBh7dB7CiKpH', module: 2 },
      { filename: 'aula4_Consolidacao_do_Imperio_1840-1853.mp4',        id: '14Ut5whw4Skl7CjF6fSDwsXIX3Q0omp8-', module: 2 },
      { filename: 'aula5_Politica_Externa_Brasileira_1822-1852.mp4',    id: '1XLl9dc6xPRvRbwedPYSS87qxcSnaaIVV', module: 2 },
      { filename: 'aula6_monitoria2.mp4',                                id: '1jgN9K5VyHcj5Pes6yGXSOtO2E1yEoLFG', module: 2 },
      { filename: 'aula7_GSintese_Gabinetes_do_Imperio.mp4',            id: '1_0KAqW5lbavjjd0i-B-2b_oioVt1Do6Q', module: 2 },
      { filename: 'aula8_Economia_do_Imperio.mp4',                      id: '1PSXFiqa4sIjHb-suRXMfc4MyUtTQZI5g', module: 2 },
      { filename: 'aula9_monitoria3.mp4',                                id: '1IDwiKvLK6W4pDmz-wfs5A6FPEHOxwORd', module: 2 },
      { filename: 'aula10_Cultura_no_Imperio.mp4',                      id: '1ig8TsxVqMlRAp04oQgeBpk-Rsde8FuEg', module: 2 },
      { filename: 'aula11_Guerra_do_Paraguai.mp4',                      id: '1l_qww45NC-7yPAlfTs2Ykvs-d_gAl7t0', module: 2 },
      { filename: 'aula12_monitoria4.mp4',                               id: '10aKgKVTwwIB7fZNG0iA3cQ2nnddF10bx', module: 2 },
      { filename: 'aula13_Geracao_de_1870_Crise_do_Imperio.mp4',        id: '18ceb_4Ed9wNgsXuPEHWlUe-ZdEVub_bT', module: 2 },
      { filename: 'aula14_Abolicionismo_Republicanismo.mp4',            id: '1MnvjM_x7Jbrc2Ro0WKH5m4TSac-UBMhe', module: 2 },
      { filename: 'aula15_monitoria5.mp4',                               id: '1YeykSQcnSQFacN842f6sLRkxNZ2ptzED', module: 2 },
      { filename: 'aula16_Politica_Externa_2o_Reinado.mp4',             id: '1vcTzvJ4gr4jwa23zZvvNGU6zcAaY2Gx-', module: 2 },
      { filename: 'aula17_Proclamacao_da_Republica.mp4',                id: '1nqYoexSbJYxbLg7iKiSoMxQkBimOBRAU', module: 2 },
      { filename: 'aula18_monitoria6.mp4',                               id: '10IwSWntcdPVFjLQD_q0zkpep7X-O6zW5', module: 2 },
      // MÓDULO 3
      { filename: 'aula1_anos_entropicos.mp4',                           id: '14ripVFheyiJNI1Hx9Q0APzh-n5pOWasc', module: 3 },
      { filename: 'aula2_campos_salles_colmeia_oligarquica.mp4',        id: '123pqNf0F9gnU1ar2oIRzKDmI7bLu4RgF', module: 3 },
      { filename: 'aula3_monitoria1.mp4',                                id: '15LKgFDmbZK2g1yGDQf8IA0KyL2-NVimO', module: 3 },
      { filename: 'aula4_politica_externa_rio_branco.mp4',              id: '1RX75UBtq53yeT8RUOg-WR_r8XuKl-ve1', module: 3 },
      { filename: 'aula5_movimentos_sociais_primeira_republica.mp4',    id: '1WNEqJK-p1XdQJDluwoJw8kGW5CMfVdZX', module: 3 },
      { filename: 'aula6_monitoria2.mp4',                                id: '1LpKH3sikSaHtwKrn_2ctUHLps-zc8j1B', module: 3 },
      { filename: 'aula7_militares_poder_desestabilizador.mp4',         id: '1zvYJQNFt3mhhmhrV7vrfLIJkudsxMo4T', module: 3 },
      { filename: 'aula8_politica_externa_anos_1920.mp4',               id: '1nU6U_QryLuS9QwjiuSGo3B4Sevrlb1Hu', module: 3 },
      { filename: 'aula9_monitoria3.mp4',                                id: '1DKcwE8VjXUIznyUaEqlAI_pEcTZSLLYS', module: 3 },
      { filename: 'aula10_crises_1a_republica_revolucao_1930.mp4',      id: '1GZl-krGEOkW5FV97KRt4rNcEc767alHK', module: 3 },
      { filename: 'aula11_era__vargas.mp4',                              id: '1ViLhtFFIuagNs6n5gqW4XlNg1LUyJy-4', module: 3 },
      { filename: 'aula12_monitoria4.mp4',                               id: '1eXPsmLVjDlh-sbBZOpCaPG4vwzThIevo', module: 3 },
      { filename: 'aula13_era_vargas_estado_novo.mp4',                  id: '1XUZVQ6FCMCD_ZODbnycunWBcP1HgN1lx', module: 3 },
      { filename: 'aula14_era_vargas_politica_externa.mp4',             id: '1Y3Nph6J5550WtdoKGFLOGFZ2YNM53Am3', module: 3 },
      { filename: 'aula15_monitoria5.mp4',                               id: '1IyWzb_76kFg5g9XCFWrGjawto4WtFTye', module: 3 },
      { filename: 'aula16_monitoria6.mp4',                               id: '1MVZ-K6OsmFHJ7ctOz_xjMrXXj1LjfQFA', module: 3 },
      // MÓDULO 4
      { filename: 'aula1_era_vargas-industrializacao_crise_estado_novo.mp4', id: '1qEpI8kdQOHdO-2u7eQTZxZIsqywA0SkH', module: 4 },
      { filename: 'aula2_redemocratizaca_gov_dutra.mp4',                id: '1W93Qxp-IWABa65fnLK7lf_DRMnxK360m', module: 4 },
      { filename: 'aula3_monitoria1.mp4',                                id: '1slV0gpFw3OOUlRrxop3XbDFKqLvHBseY', module: 4 },
      { filename: 'aula4_transicao_segundo_vargas_e_jk.mp4',            id: '1pOwgcF-fJh592q_b4a8k5xR-78H_elCh', module: 4 },
      { filename: 'aula5_janio_jango.mp4',                               id: '1f5wMdzG2zI7nVlYeRIbk6wQblWfWfETB', module: 4 },
      { filename: 'aula6_monitoria1.mp4',                                id: '1QkBvl7HTqzMyLMtj3rvGRnGbpoFTyuX1', module: 4 },
      { filename: 'aula7_castelo_branco_costa_e_silva.mp4',             id: '1YjRz_y0zhgXr1oUM4llQKMqfU2VrPtmw', module: 4 },
      { filename: 'aula8_const_1967_medici.mp4',                        id: '1WVwHkqorCqeDyiw8auI3tRvA-JStwnS3', module: 4 },
      { filename: 'aula9_monitoria3.mp4',                                id: '1_MaYYjBI0k88zYtjnAS5KELwYoaGMhXs', module: 4 },
      { filename: 'aula10_geisel.mp4',                                   id: '1Y3TNRsqRiHasyCytclLlFp9sdRR2XcC_', module: 4 },
      { filename: 'aula11_figueiredo.mp4',                               id: '1OHiXhLr8taQiklGfkvMZb4n-tCm_EwlZ', module: 4 },
      { filename: 'aula12_politica_externa_regime_militar.mp4',         id: '1pmsIiEsLAhqhB1KAkc8mhZOJuchBrIvj', module: 4 },
      { filename: 'aula13_diplomacia_cultural_regime_militar.mp4',      id: '1RxZ1DQjQjjEAF3oMvKnnsDM5NxFjg2-h', module: 4 },
      { filename: 'aula14_relacoes_bilaterais_brasil_argentina.mp4',    id: '1c2rrWP6L92na5dtgzI1gqKpSJo7lzpRi', module: 4 },
    ],
  },
  {
    subject: 'História Mundial',
    lessons: [
      // MÓDULO 1
      { filename: 'aula1_absolutismo_mercantilismo_rev_inglesas.mp4',    id: '1v19AD1gEjXeZKWqk_40XbXVhsojxU_sQ', module: 1 },
      { filename: 'aula2_iluminismo_rev_francesa.mp4',                   id: '1BO6jRVkI9i1V7Q2mve0csGRKHm2XIzkO', module: 1 },
      { filename: 'aula3_monitoria1.mp4',                                id: '19aT8IvjRAu6PhN0RAVgTvfTv8TiLsKkk', module: 1 },
      { filename: 'aula4_periodo_napoleonico_congresso_de_viena_p1.mp4',id: '1765PiDkXvCJp1RWqGoHKZtVAbNChJHRf', module: 1 },
      { filename: 'aula5_periodo_napoleonico_congresso_de_viena_p2.mp4',id: '19svKbKNGifTV3AUHfby3tatYNU23gtsZ', module: 1 },
      { filename: 'aula6_monitoria2.mp4',                                id: '13n4UBo0SL_yVV62EifyTKpyRIx6anrzm', module: 1 },
      { filename: 'aula7_liberalismo_unificacoes_1820_1890_p1.mp4',     id: '1TKzX1qZyN_MBPcIDUre6LNyc1tsITEV3', module: 1 },
      { filename: 'aula8_liberalismo_unificacoes_1820_1890_p2.mp4',     id: '1YgEAbWF7ScdLsmYs11rN4zf6fP1egM54', module: 1 },
      { filename: 'aula9_monitoria3.mp4',                                id: '1cltbZlFyW27U38QYudZl7qm_zYZ9o4KQ', module: 1 },
      { filename: 'aula10_imperialismo_teoria_estudos_de_casos.mp4',    id: '1XEpm8btXtGOXMcv3u8SxWOr8AZjJh2Ji', module: 1 },
      { filename: 'aula11_EUA_da_Independencia_a_marcha_para_oeste.mp4',id: '11ty4EWzxKz91dGkZRBZ3Ezs9NXr0lyM6', module: 1 },
      { filename: 'aula12_monitoria4.mp4',                               id: '1faOTqsgQ0TpX7kDUAhJJDvEWCxGaENR5', module: 1 },
      { filename: 'aula13_EUA_Guerra_Civil_ao_Big_Stick.mp4',           id: '1ub4Ps6hX3Dp7ZfM7PLPxondz1auvLRFu', module: 1 },
      { filename: 'aula14_america_latina_sec_XIX.mp4',                  id: '1hiZfPmX3zBWLxi8gYk-VpjfTZEwvWMPK', module: 1 },
      { filename: 'aula15_monitoria5.mp4',                               id: '1S6a5VROJKK_eBynT1P3Umk7kgyrtpyLd', module: 1 },
      // MÓDULO 2
      { filename: 'aula1_o_mundo_entre_1890_1914.mp4',                  id: '1AO7UZCE6vq9h3RZXTCaMN47qw-nC7TOW', module: 2 },
      { filename: 'aula2_primeira_guerra_mundial.mp4',                  id: '1ZVo6B94_GPKSPkHlNoZfvamcFW0eCw5X', module: 2 },
      { filename: 'aula3_monitoria1.mp4',                                id: '1bCIzRev17Kzd_ZTwWtjcEcerJ7kBT04M', module: 2 },
      { filename: 'aula4_entre_guerras_ascencao_fascimo.mp4',           id: '1W3vjb6kiX-q7GoxDjII-peyEXwy5tsFw', module: 2 },
      { filename: 'aula5_segunda_guerra_mundial.mp4',                   id: '15HFmqXLKdAkfstlObLxWA2r7uugM6Puh', module: 2 },
      { filename: 'aula6_monitoria2.mp4',                                id: '1qm7OErhLOS3iBKCiND7SV6lmPT7Ieka2', module: 2 },
      { filename: 'aula7_segunda_guerra_mundial_p2.mp4',                id: '1o_SO-bhQ5jzxXiH8COLJhrpxdb1osRX2', module: 2 },
      { filename: 'aula8_guerra_fria_montagem_do_sistema.mp4',          id: '1l1HGobQMORzj_hheHqz-YrIkxgcm42mQ', module: 2 },
      { filename: 'aula9_monitoria3.mp4',                                id: '1v0QwTjVVH2011Bc4bzvtgCKItCk4kpt4', module: 2 },
      { filename: 'aula10_guerra_fria_apogeu_detente.mp4',              id: '1SYB0jjUySj8NmsiuAoo5pjZycoYq14nl', module: 2 },
      { filename: 'aula11_lutas_libertacao_colonial.mp4',               id: '1KB_sFp72fPNYGrvhZH-FqdJPaT6jelLq', module: 2 },
      { filename: 'aula12_monitoria4.mp4',                               id: '18-1dyOrWqYjlBdf3SLFmWUCs9Dbfqu74', module: 2 },
      // MÓDULO 3
      { filename: 'aula1_mundo_socialista_colapso_urss.mp4',            id: '1eIy3P0L-Nvo2hfWLJ4X86yCDIVCzKyCp', module: 3 },
      { filename: 'aula2_sistemas_internacionais_metternich_bismarch_pax_britanica_bipolaridade.mp4', id: '1DCQ_wzgxsYrfKtL18_z1cmHz7ZYBiM3N', module: 3 },
      { filename: 'aula3_monitoria1.mp4',                                id: '10UbjjC420JndnH6zzIIDe5Y3iK0wlDr-', module: 3 },
      { filename: 'aula4_america_latina_sec_xx.mp4',                    id: '1gU2yCSfxGgWR1cBkyAekjNpAgNIJpvCb', module: 3 },
      { filename: 'aula5_america_latina_sec_xx_p2.mp4',                 id: '1MuA9oWw_MGX92LTOhV5sFpZ9Vq1MwizK', module: 3 },
      { filename: 'aula6_monitoria2.mp4',                                id: '1j_NDcNiukjv8rs0aEBpxjYUiGfXL6Hcf', module: 3 },
      { filename: 'aula7_panorama_cultural_europeu_sec_xix.mp4',        id: '1KVVzaLDxLQm-tiYw7Xrw1d1mJO5vyKCr', module: 3 },
      { filename: 'aula8_panorama_cultural_europeu_1a_metade_sec_xx.mp4',id: '1FPMIaS1MZxYgvSHQcDdwN3F4oHfdIbP-', module: 3 },
      { filename: 'aula9_monitoria3.mp4',                                id: '1WOaC8xQY7YB25zfj30CBxh2P2DU-2I8m', module: 3 },
      { filename: 'aula10_panorama_cultural_eua_america_latina_sec_xx.mp4', id: '1NhSZniDETVI01EuASEQYVWNftAtAfR9l', module: 3 },
      { filename: 'aula11_monitoria4.mp4',                               id: '16sKCJLGO3drVhA3HtVuiBUVnOpC14sJm', module: 3 },
      { filename: 'aula12_africanismo_pensamento_africanista_sec_xx.mp4',id: '1CjTVNzX_h1DBkzTOL36MnDJ9eRyNQYYt', module: 3 },
      { filename: 'aula13_monitoria4.mp4',                               id: '1h1evrJY_mQTKouch3Ctu3L9MKGcasTW_', module: 3 },
    ],
  },
  {
    subject: 'Português',
    lessons: [
      // MÓDULO 1
      { filename: 'aula1.mp4', id: '1euER-KBrusAlmQfe57YbvQwttzjwUKur', module: 1 },
      { filename: 'aula2.mp4', id: '1pZabhjmE245HQGbem10P7KQhp27ENWrd', module: 1 },
      { filename: 'aula3.mp4', id: '1UsdPsCb4qUL2Qy2567W75WjEJUf19JZp', module: 1 },
      { filename: 'aula4.mp4', id: '1p6-7uw17eQ00a4myC2p5lRcXfY7_aADy', module: 1 },
      { filename: 'aula5.mp4', id: '1K1DUZ8bZej_WakokLose41YZuHCCpAFV', module: 1 },
      { filename: 'aula6.mp4', id: '10Sqnxu4-Ea1eKFEy78yQU_lppEQwd4BP', module: 1 },
      { filename: 'aula7.mp4', id: '1d5yd2O5yCe5QdBsF1glxnNXV0yyPBTZn', module: 1 },
      { filename: 'aula8.mp4', id: '1IdXlRk2d5jJflM8qUfhHv9s-IUadM1HZ', module: 1 },
      // MÓDULO 2
      { filename: 'aula1.mp4', id: '18qneZ-vbFxjOqFVN1L7V0Qdb1UPg22R1', module: 2 },
      { filename: 'aula2.mp4', id: '1Tt00seirx_TKTO8Wf9d_kqIEyMYYM32l', module: 2 },
      { filename: 'aula3.mp4', id: '1HtdgdUUz-TmnDM7RrnGbrp0nPFwbetES', module: 2 },
      { filename: 'aula4.mp4', id: '19kqrTSdY3GCMJIrEXjzlJk0jsU4tgOks', module: 2 },
      { filename: 'aula5.mp4', id: '1KUivEtgIr5Atzmrsv6jeEfcddIbFVP9l', module: 2 },
      { filename: 'aula6.mp4', id: '1ITJOBFUj24CVXpQ6Cl2i5KVQvfTP1JiF', module: 2 },
      { filename: 'aula7.mp4', id: '1ANFoxzgKdhMg1eofIHkyZ6CfwHryS-t8', module: 2 },
      { filename: 'aula8.mp4', id: '1yAHdVIASlh66TDJGn-RILLpsjUNMZgOW', module: 2 },
      // MÓDULO 3
      { filename: 'aula1_colocacao_pronominal.mp4',    id: '1kJm9AWDXkce0n7-DwAFnRLAXCxf2ikJG', module: 3 },
      { filename: 'aula2_concordancia_nominal.mp4',    id: '1n_d4Dc4tqHN339IsJM7GWdmdKI8GLI0T', module: 3 },
      { filename: 'aula3_concordancia_verbal.mp4',     id: '138yv3qmaS1YSTKoyfmyphi9FGD7gb36s', module: 3 },
      { filename: 'aula4_pontuacao.mp4',               id: '12YkCyJvEgcLX5PiCkWgC4s3Dagr6mgPH', module: 3 },
      { filename: 'aula5_figuras_linguagem.mp4',       id: '13o7gRnRBsaHqaqmYB3FWIdEm-UG8i69l', module: 3 },
      { filename: 'aula6_estilistica_poetica.mp4',     id: '1xEIORUs0GKB7RK_9UutdHtobBR-54Vd-', module: 3 },
      { filename: 'aula7_literatura_brasil1.mp4',      id: '1rxcwGGpGvUsBxrl8lGQeNQw9VMaSfQK1', module: 3 },
      { filename: 'aula8_literatura_brasil2.mp4',      id: '151owUp8XTh1-jynYa_EbB0vQaaGbubsy', module: 3 },
    ],
  },
  {
    subject: 'Inglês',
    lessons: [
      // MÓDULO 1
      { filename: 'aula1_the_start.mp4',                                    id: '1k9ZCQiQiIMwaWZT5m7YxIbg0uRuYWE02', module: 1 },
      { filename: 'aula2_tps_going_deep.mp4',                               id: '1MBIpP1ImJsINSPi0kWuSe_bpbOa4UJvh', module: 1 },
      { filename: 'aula3_all_about_grammar_phase_2_composition.mp4',       id: '1mBwMvst_1DVUgL32UljTd0-XSMF4j-o5', module: 1 },
      { filename: 'aula4_all_phase_2_of_the_sections_and_mistakes.mp4',    id: '1lFMsbIZ4yixxfjoDgLYtgCBZmdSIjkHX', module: 1 },
      { filename: 'aula5_bad_habits_dos_and_donts.mp4',                     id: '1HClenydNHZwNNB9e9FPvjVwgTtse2YZg', module: 1 },
      { filename: 'aula6_grammar_problems1_and_advanced_techniques.mp4',   id: '1jI8CqDvGIiC2U3U-VCZ6GOvk2qB8UVe8', module: 1 },
      { filename: 'aula7_grammar_problems2_and_espelho_reviews.mp4',       id: '1DQRpMZradxacnggL3Gug4-2A1Htx-zJQ', module: 1 },
      { filename: 'aula8_tps_and_compositions_good_and_bad.mp4',           id: '1UV5gR3QRvu_a6mBLrEku2fekiauD9RDn', module: 1 },
      // MÓDULO 2
      { filename: 'aula1_possible_future_questions_and_summary_practice.mp4', id: '1w75k7Ryqo7SxAaR3InDG4gmi8Z_GZ9kD', module: 2 },
      { filename: 'aula2_feedback_and_the_composition.mp4',                id: '16SxUDpWxHTZqmagEHinIjExKq-Knp6fN', module: 2 },
      { filename: 'aula3_the_summary_tps.mp4',                             id: '1HeH3ZL2hhg0nJGJiX51ZxvtGo_5S11v_', module: 2 },
      { filename: 'aula4_how_to_deal_with_impossible_translations.mp4',    id: '1OUClP9ogFHZj8HvSsY7Zww5_hsBkjG4E', module: 2 },
      { filename: 'aula5_vocabulary_improvement.mp4',                      id: '18iFB1GtMebayFn2DQslGNQb7zjOdc9zV', module: 2 },
      { filename: 'aula6_composition_and_summary.mp4',                     id: '1nmPhfa7zCbpSitaJMktpXdz7NvkXUQr3', module: 2 },
      { filename: 'aula7_answering_the_tps_exam_strategy.mp4',             id: '1p1Fyi7if0o84_ZfoOhsvOe-FLy81UFUg', module: 2 },
      { filename: 'aula8_the_iades_compositions_mistakes.mp4',             id: '1rFUDFc5hPJKpGzUCIRfehPB4aYl-1zCH', module: 2 },
      // MÓDULO 3
      { filename: 'aula1_tps.mp4',                                         id: '1rKKtP6hql0g8KsdG_qqKqoT5uXG8URWN', module: 3 },
      { filename: 'aula2_vocabulary.mp4',                                  id: '1BJxKI5Mkot_BZ7rCjRwX-YaPQQ96S5gC', module: 3 },
      { filename: 'aula3_translation.mp4',                                 id: '1yUJa7XS2T0wzl7q2k2nqJIlRPAI2tdro', module: 3 },
      { filename: 'aula4_planning_and_arguments.mp4',                      id: '14cFDrA2NSSxcu_inLoddPF2bNZXm23_j', module: 3 },
      { filename: 'aula5_tps2.mp4',                                        id: '1_hnDYJQtbmLjqiEf7k0r5akQV9we6FAh', module: 3 },
      { filename: 'aula6_tps3.mp4',                                        id: '1OLk4lw_L6JMHqokeALUDYM3iZLZK5tGW', module: 3 },
      { filename: 'aula7_a_full_exam.mp4',                                 id: '1FPeLvYSMELfKpHXwK8rz4jK4VrhRVTGZ', module: 3 },
      { filename: 'aula8_final_review.mp4',                                id: '1mjT3TR-vtpQjLY6TakbYhyzke7Q8m9Rr', module: 3 },
    ],
  },
  {
    subject: 'Francês',
    lessons: [
      // MÓDULO 1
      { filename: 'aula1_recommandations_pour_les_etudes_phonetique_et_accents.mp4', id: '1N5P7PiG7ajYK-EruNH8oJPUq4DQTR1XL', module: 1 },
      { filename: 'aula2_articles_definis_indefinis_et_contractes.mp4',   id: '1Orms9AUz5zQrnSz47qr2_cNOS8EilrWd', module: 1 },
      { filename: 'aula3_articles_definis_indefinis_et_contractes.mp4',   id: '1rXyMe6mzZidhNY_Mm4tYPJOhUZFXolcE', module: 1 },
      { filename: 'aula4_phrase neative_et_phrase_interrogative.mp4',     id: '1qHGraW9ZIXUrXP_N4HllJnuO31RvAhTI', module: 1 },
      { filename: 'aula5_futur_simles_futur_proche.mp4',                  id: '13CLcsGkNiboJO6M7AAtJPXfWXylAzmDw', module: 1 },
      { filename: 'aula6_gentre_nombre_et_artciles_partitifs.mp4',        id: '1N58_7FX6zNqmDcVUBxK2TBSBnJosR51v', module: 1 },
      { filename: 'aula7_adjectifs_possessifs_et_demonstratifs.mp4',      id: '1zY2rwqyEx_fqMsY9DS3Uxyu2e9ArTeNJ', module: 1 },
      { filename: 'aula8_adverbes_et_pronoms_relatifs_simples.mp4',       id: '1DHwT0JME2XHHdHlvpORzZP0g_D7py8rL', module: 1 },
      // MÓDULO 2
      { filename: 'aula1_passe_compose.mp4',                              id: '1YE2qkxrmhykJgKxQQCfvVt1BwBFDTNO7', module: 2 },
      { filename: 'aula2_pronom_cod.mp4',                                 id: '1s6hpOOUcMDACrDa0cN6ghEDkaNqNMg0G', module: 2 },
      { filename: 'aula3_pronom_coi.mp4',                                 id: '1dzF9sEP5iHTIvymmOj-IPc0iRaCfcdum', module: 2 },
      { filename: 'aula4_pronoms_en_et_y.mp4',                            id: '1RF9h20soEYzrhXsEusEkm9K2LvgVoH_3', module: 2 },
      { filename: 'aula5_limparfait_de_lindicatif.mp4',                   id: '1MrJkLZ3JBgoxrh6bJ2AuR_tsGxBt7Ohw', module: 2 },
      { filename: 'aula6_plus_que_parfait_et_futur_anterieur.mp4',        id: '16jAx5YkE0jT9ylwTJLjxF8ww0paSQVRR', module: 2 },
      { filename: 'aula7_pronoms_possessifs_et_demonstratifs.mp4',        id: '1ZGI2vLMCIwAvJdXyeKbcDSLLAMTLhCvR', module: 2 },
      { filename: 'aula8_accord_du_participe_passe.mp4',                  id: '1fmOtkhctHsZfGEeumKW0rfno7uCvWn_x', module: 2 },
      // MÓDULO 3
      { filename: 'aula1_participe_present_et_gerondif.mp4',              id: '1cP0L-ynbnQmt4t1dDQ3SKe0sjTI9dkau', module: 3 },
      { filename: 'aula2_subjonctif_present_et_passe.mp4',                id: '10WRBGwcWEgrOA7nkaAw-_90Can1lJFID', module: 3 },
      { filename: 'aula3_conditionnel_present_et_passe.mp4',              id: '1q8fL92hx4W3hsqF35ERg-pZNbuaLbxGe', module: 3 },
      { filename: 'aula4_relations_logiques_hypotheses.mp4',              id: '1pw30vf5mCmewXWy1wCXYWVXX25rQfqoY', module: 3 },
      { filename: 'aula5_relations_logiques_expression_de_la_cause.mp4', id: '1Go37mh3qVH6H-cOY6Dd_bpZmPdEi3F_C', module: 3 },
      { filename: 'aula6_relations_logiques_expressions_de_la_consequence_et_du_but.mp4', id: '1dgdglrfc5igcoDzBYfTT6fPTXJH28MLm', module: 3 },
      { filename: 'aula7_expression_de_loposition_et_de_la_concession.mp4', id: '1FGyJkE6tS4CzmupV9jfGlDtavJAOGXf3', module: 3 },
      { filename: 'aula8_laddition_lillustration_la_synthese_et_la_progression.mp4', id: '1tsQdNYpDW-ZkgfItsi0kngvm3fNo3yt_', module: 3 },
    ],
  },
  {
    subject: 'Espanhol',
    lessons: [
      // MÓDULO 1
      { filename: 'aula1_introduccion.mp4',                               id: '11SuP2fYT_s_aLpguIJwVtnQvF_hctiNB', module: 1 },
      { filename: 'aula2_presente_del_modo_indicativo_1.mp4',             id: '1DMF0EKbatQFvOMmhEPIEcASCM2Dr5neQ', module: 1 },
      { filename: 'aula3_presente_modo_indicativo_2.mp4',                 id: '1jjkv0Ro6feS1_nqE8H4oXHT42oejw0Uz', module: 1 },
      { filename: 'aula4_modo_indicativo_gustar_y_construcciones_valorativas.mp4', id: '11oTx8kOp6cH_QivQrhoDHEQRl-pZZ3Qs', module: 1 },
      { filename: 'aula5_preposiciones_1.mp4',                            id: '1TLHnXz_4ldo1bOC_hmkSU8Am0jPd45sv', module: 1 },
      { filename: 'aula6_preposiciones_2.mp4',                            id: '1NVdH-_IlP6J1ENVKfKQk3G_KPi_8PucX', module: 1 },
      { filename: 'aula7_preterito_perfecto_compuesto_1.mp4',             id: '12HOhpQy8OtUzJBcb86UEZDVbqsn_YcO-', module: 1 },
      { filename: 'aula8_preterito_perfecto_compuesto_2.mp4',             id: '1Xt3CZsZd2P88Ic8r5ae7RW_0ddjerPCl', module: 1 },
      // MÓDULO 2
      { filename: 'aula1_preterito_perfecto_simples_1.mp4',               id: '1GRqFa04ANRznym3qB0JXrwC7B0rTa55F', module: 2 },
      { filename: 'aula2_preterito_perfecto_simples_2.mp4',               id: '16uU_T53Dhb1fEFmo52AGuGaW0htFsxc8', module: 2 },
      { filename: 'aula3_verbos_pronominales.mp4',                        id: '1RYT6nfbxTxWACjLsRUOpbB7J97lM-t1Y', module: 2 },
      { filename: 'aula4_demonstrativos.mp4',                             id: '1WAttS26RS4YtnTf9BVwb0lLtam6c3Ytw', module: 2 },
      { filename: 'aula5_pronombres_posesivos_1.mp4',                     id: '1Zh1KT7W94PCdk7d2rKexgXTDUq-cKSOy', module: 2 },
      { filename: 'aula6_pronombres_posesivos_2.mp4',                     id: '1RscK4FTNt1uN9RtZt3kmykS2IIaYkRko', module: 2 },
      { filename: 'aula7_pronombre_complemento_directo.mp4',              id: '1Jr8QqDRxL6Mq6G5GzM_XteoQ3f1qfyY9', module: 2 },
      { filename: 'aula8_pronombre_complemento_indirecto.mp4',            id: '18O1Z8ygJ55T4MYe_LU-toTe3Zc9Hp5TP', module: 2 },
      // MÓDULO 3
      { filename: 'aula1_perifrasis_verbales_1.mp4',                      id: '1bH45WiNINb9RfcIXz9kzOaxauWcjf-9g', module: 3 },
      { filename: 'aula2_perifrasis_verbales_2.mp4',                      id: '1k0nAEHNnFm1FFX6WfkwZ91TLsh0VPgHt', module: 3 },
      { filename: 'aula3_preterito_imperfecto1.mp4',                      id: '1gIk030DEOTBTQ0MLqw_r6fEEC7li0KQU', module: 3 },
      { filename: 'aula4_preterito_imperfecto2.mp4',                      id: '17gE4sWDE0uugnNrApoec3ZOguP7CZFcs', module: 3 },
      { filename: 'aula5_imperativo1.mp4',                                id: '11BY5dISBgpmPpMn9TBvhQ7tx8Ko4NF4B', module: 3 },
      { filename: 'aula6_imperativo2.mp4',                                id: '142HobqDsNA09t5OyNTnDoQO3B9gJEUPs', module: 3 },
      { filename: 'aula7_contrastes_de_preteritos_1.mp4',                 id: '1L76qPf6Pvcod6xY9AcMfjAyhPxc_Q9qg', module: 3 },
      { filename: 'aula8_contrrastes_de_preteritos2.mp4',                 id: '1SS7HxHPPKyGDsLJmN26PpJGwfViO7b8K', module: 3 },
    ],
  },
  {
    subject: 'Economia',
    lessons: [
      // MÓDULO 1
      { filename: 'aula1_conceitos_iniciais.mp4',                id: '19wwOg90hZRfbbqTIEe-yLJ4IJAMXzrsE', module: 1 },
      { filename: 'aula2_elasticidade_e_impostos.mp4',           id: '1mGbQshmDG3a9_HUTrrw3AYW54e2g5LWs', module: 1 },
      { filename: 'aula3_teeoria_do_consumidor.mp4',             id: '17mk3BlhLuv5WX9r6epNR4lCgEnDiVzLS', module: 1 },
      { filename: 'aula4_teroria_da_firma_p1.mp4',               id: '1r3zZYY7F2CouPEFjIFF9v6XYqCNJ-2oK', module: 1 },
      { filename: 'aula5_teoria_da_firma_p2.mp4',                id: '13mKKpl6-heZg1Upc-jX576xVnBnu60wt', module: 1 },
      { filename: 'aula6_tconcorrencia_perfeita.mp4',            id: '1tbRrlZgKdq5iuk-0up6skytXJIRPzDMH', module: 1 },
      { filename: 'aula7_monopolio.mp4',                         id: '1B89nrc_NBEXhbwjTe7cBBnBrIrudIQDw', module: 1 },
      { filename: 'aula8_oligopolio.mp4',                        id: '1I3ddIMw75LQT3o1QKb_-d8U4L8Brrecd', module: 1 },
      // MÓDULO 2
      { filename: 'aula1_contabilidade_nacional.mp4',            id: '1ODnVietHxSCsnllHK5uYW8EprQ-57byC', module: 2 },
      { filename: 'aula2_instrumentos_politica_comercio_exterior.mp4', id: '14Q5pb8-m2RLvKlIWzq3JXQQ06tbZscDC', module: 2 },
      { filename: 'aula3_liberalismo_comercial_critica_cepal.mp4',    id: '1IKN8CLgdPk_rfYR8yTsMGq8mhf1qxfZE', module: 2 },
      { filename: 'aula4_teorias_classica_keynesiana.mp4',       id: '1PC-PFv2SZSiduM4ORTwIqRyfIjnZgqa7', module: 2 },
      { filename: 'aula5_moedas_bancos.mp4',                     id: '1vyM_7vt6v6ZqGQyWiKX-sHc-7HN-OVye', module: 2 },
      { filename: 'aula6_polilitica_monetaria.mp4',              id: '1TYj5LiUAqFPyWexQmLChoNKRjCJXKaJe', module: 2 },
      { filename: 'aula7_politica_fiscal.mp4',                   id: '1xeeSeUXAjmTSMiWfRqyk-9vqwEXA1SaF', module: 2 },
      { filename: 'aula8_tradeoff_politica_economica_desenvolvimento.mp4', id: '1vs_MQAJt7KSInhdFjfmzMY-vUmYUeyrz', module: 2 },
      { filename: 'aula9_balanco_de_pagamentos.mp4',             id: '1Lhuy1i-PTjCmFOsp64riruebOAO2Ztkv', module: 2 },
      { filename: 'aula10_cambio.mp4',                           id: '1aOz9d7VMCSsy1pZOIay2lN7jsQBeCIrW', module: 2 },
      { filename: 'aula11_modelo_is_lm_bp.mp4',                 id: '1KB2y_Jo_ytXnjIEhoZWUYdiS7KBoY7sX', module: 2 },
      { filename: 'aula12_fluxos_internacionais_bens_capital_servicos.mp4', id: '1UGZ-2Ec1QLrtWsNidT3DyiWRVlVIhFPN', module: 2 },
      // MÓDULO 3
      { filename: 'aula1_economia_brasileira_ixi_cafeeira.mp4',  id: '1LDNVAVDkFUWOCs2bpwsUeTCd6BOjI2jr', module: 3 },
      { filename: 'aula2_primeira_republica_a_rev_30.mp4',       id: '16FyXTZGLa9gOaOiw3778AU9Di_2RnyON', module: 3 },
      { filename: 'aula3_industrializacao_1930_a_1945.mp4',      id: '13SeWGbS7K6xHfQeuIQ9GlQbvR5j90MEu', module: 3 },
      { filename: 'aula4_pos_guerra_segundo_gov_vargas_planos_de_metas.mp4', id: '1oySsKcOfMtc9ooDnNGebm54uz9DgwfSg', module: 3 },
      { filename: 'aula5_crise_1960_PAEG.mp4',                   id: '1vGRpzzAmGX4PrYmeaT-qtUcU_IrYRMcR', module: 3 },
      { filename: 'aula6_milagre_economico_brasileiro.mp4',      id: '1mvPVybBR5DU755vjCYgZo5iXxvmPq8iU', module: 3 },
      { filename: 'aula7_II_PND_ajuste_externo.mp4',             id: '1xGxjC9yETi6JQ5RINv7J8cDQdW0x3brQ', module: 3 },
      { filename: 'aula8_planos_estabilizacao_1985_1989.mp4',    id: '1PkBiYomWEa_klzwvsv9lTiZYzm39j3Jq', module: 3 },
      { filename: 'aula9_anos_90_aberturas_privatizacoes.mp4',   id: '1lhcL7DBzDUDGSbZyxqr0m59cMpixYCLU', module: 3 },
      { filename: 'aula10_consolidacao_da_estabilizacao_reconstrucao_institucional.mp4', id: '1a9Hz8gR4eHzNyLjBVeViG6fuFx5n6UI1', module: 3 },
    ],
  },
  {
    subject: 'Direito Interno',
    lessons: [
      // MÓDULO 1
      { filename: 'aula1_normas_juridicas.mp4',                       id: '1qjcc8l_Z4ZSwNMLg2NGIsFy4Z5oZO89h', module: 1 },
      { filename: 'aula2_personalidade_juridica.mp4',                 id: '1xobd2xZUWudKQS3FlE0dG4PTCIUS2MZ2', module: 1 },
      { filename: 'aula3_constituicao_controle_constitucionalidade.mp4', id: '1otqCq8ZHe5eLNv8b4uZsZpRJVs0BpSk9', module: 1 },
      { filename: 'aula4_conntrole_constitucionalidade.mp4',          id: '1Ke7bIjPh7YxnMETCEhKsv7nlRGtg4k-3', module: 1 },
      { filename: 'aula5_estado.mp4',                                 id: '1aX_VDVP9CepDFXPzHWKxR-XRBFJbUphy', module: 1 },
      { filename: 'aula6_estado_democratico_direito.mp4',             id: '10YCRPD2cDsYImjKKMHFqLke6WN1e3J2l', module: 1 },
      { filename: 'aula7_organizacao_competencia_poderes.mp4',        id: '1pfxbODufVW2tm4VGs5zSq-0FSt8m68gS', module: 1 },
      { filename: 'aula8_direitos_fundamentais.mp4',                  id: '1lz_Ob2n-yCKGu0aiEGVDueEjzKpmB8Zg', module: 1 },
      // MÓDULO 2
      { filename: 'aula1_adm_publica.mp4',                            id: '1em1crXtzOT6KsUZxCbr9gesDgCi484Ie', module: 2 },
      { filename: 'aula2_atos_administrativos.mp4',                   id: '1r5C-WSQn0LjRXNBebh9NrSkcmePGrrNr', module: 2 },
      { filename: 'aula3_contratacao_adm_publica.mp4',                id: '11dAuF49pVPyGHbdYQ_r3Z41jV90BkNPr', module: 2 },
      { filename: 'aula4_resp_civil_estado.mp4',                      id: '1NDbk522BExrLTFuGFiUBoKqdIrW1ShU5', module: 2 },
      { filename: 'aula5_direitos_deveres_servidores_publicos.mp4',   id: '19-bqHTqaZPqf3JMwlnB79lgNM4pMWLj5', module: 2 },
      { filename: 'aula6_regime_juridico_servico_exterior.mp4',       id: '1-xia_Hp4jjDLfkxK4jrNuQ1YewPvkXSm', module: 2 },
      { filename: 'aula7_financas_publicas.mp4',                      id: '1pN4whhyBYbRSWSsw8KvDA9TyBOjj7jz8', module: 2 },
      { filename: 'aula8_direito_internacional_privado_lindb.mp4',    id: '19ORZwLmnMJzlawSNfOX1FK_PeeBN8RYd', module: 2 },
    ],
  },
  {
    subject: 'Geografia',
    lessons: [
      // MÓDULO 1
      { filename: 'aula1_historia_geografia.mp4',                     id: '16ikDG560clJixXEeKl-615otamtefwkI', module: 1 },
      { filename: 'aula2_conceietos_fundamentais.mp4',                id: '174sOYRNVHNzBqrJJiBo62_kU2q_71sPr', module: 1 },
      { filename: 'aula3__urbanizacao_formacao_redes_cidades.mp4',    id: '1Y17eUqOx56W1jcasUpfNr7UDR6r7m3_z', module: 1 },
      { filename: 'aula4_rede_urbana_brasileira_papel_cidades_medias_modernizacao.mp4', id: '1uUGfjlLfoJ4XDZb85fvAq8jowMr_Pomv', module: 1 },
      { filename: 'aula5_rede_urbana_brasileira_papel_cidade_media_modernizacao.mp4',   id: '1Q8wauSha-oBgqgWtthgV-gfhDENYxX1U', module: 1 },
      { filename: 'aula6_rede_urbana_papel_cidades_medias_modernizacao_p2.mp4',         id: '1PYhZauONjr2iA3-L-NwSXrxvbzq_DFbQ', module: 1 },
      { filename: 'aula7_dinamica_demografica_mundial_distribuicao_populacao.mp4',       id: '1zLSIfRg93AhYyNrWU6CBqA4kTOW0VP73', module: 1 },
      { filename: 'aula8_dinamica_demografica_brasileira_estrutura_etaria.mp4',          id: '1OkMEKp4syMXaIsx9zZyyHTscOCLOjeag', module: 1 },
      { filename: 'aula9_migracoes_espaco_mundial_p1.mp4',            id: '17XeDsKecNI3F8tOIFQycKM0yEfxgv297', module: 1 },
      { filename: 'aula10_migracoes_espaco_mundial_p2.mp4',           id: '1qlqMry6CJfNKlp9GXmx4fOvxqO0GbrjO', module: 1 },
      // MÓDULO 2
      { filename: 'aula1_divisao_internacional_trabalho_reordenamentos_pos_fordista.mp4', id: '1Hqz6m3yJh3QXjgCzExAh-i1rIoLMOiTS', module: 2 },
      { filename: 'aula2_globalizacao_integracao_regional.mp4',       id: '18rpRfHyoTt8bY2Lvd2aZSsDiQBdArR6Z', module: 2 },
      { filename: 'aula3_inddustrializacao_brasileira_p1.mp4',        id: '1cglunJqg5nnHNzfsYFT-FdCDx0MiZAtA', module: 2 },
      { filename: 'aula4_industrializacao_brasileira_p2.mp4',         id: '1Qxa0EYGsitlOwX7GdmD3NEwaileByMXX', module: 2 },
      { filename: 'aula5_fontes_energia.mp4',                         id: '1vnEvwLdG97fD_LxLYKINTii8W9r_3S_2', module: 2 },
      { filename: 'aula6_fontes_energia_br.mp4',                      id: '1WJsTC1oHieFwRUWXt-m8IxeS1ten6J4K', module: 2 },
      { filename: 'aula7_logistica_espaco_mundial_e_br.mp4',          id: '1aJZMJwlTK_sHiFTGOkAsRpvD4ES6mTIU', module: 2 },
      { filename: 'aula8_espaco_agropecuario_mundial.mp4',            id: '1tXBklaRlrl-gppxOxkYQXmr6cyxGx9AI', module: 2 },
      { filename: 'aula9_estruturacao_funcionamento_agronegocio_br.mp4', id: '1q1g3BI8sDTHawViY8i4b1Uw4skTdL1Jy', module: 2 },
      { filename: 'aula10_estrutura_fundiaria_br.mp4',                id: '1ABxJwsguBvVsktEhoEUmnkcqyUNzY1PN', module: 2 },
      // MÓDULO 3
      { filename: 'aula1_geografia_politica_relacoes_espaco_poder.mp4', id: '1c7wH6E2DlZmucz_3PEch6hkEkiGi-PS6', module: 3 },
      { filename: 'aula2_geopolitica_hotspots_geopolitica_br.mp4',     id: '1_B-08AaFDFeURG6BnRvL3VxEwyrFexc3', module: 3 },
      { filename: 'aula3_integracao_territorio_faixa_fronteira.mp4',   id: '1gCh5uSwHlKmCntusDcUMlKs6XLMBHIa6', module: 3 },
      { filename: 'aula4_ordenamento_territorial_brasil.mp4',          id: '1tGSosHOmxd88q1Pr6BUBhUtIu84Io8ip', module: 3 },
      { filename: 'aula5_biomas_dominios_morfoclimaticos.mp4',         id: '13gCocSYvNjsc_iBcGxN3FxRVhfBnYzAv', module: 3 },
      { filename: 'aula6_recursos_hidricos_hidrogeopolitica.mp4',      id: '1eDxTpXsgF0Gm6chp6PVbJewxJflHjf-o', module: 3 },
      { filename: 'aula7_ordem_ambiental_mundial.mp4',                 id: '1XVvrLRZtglDMgO3yp9S76kJxrl7b2CA5', module: 3 },
      { filename: 'aula8_politica_ambiental_br.mp4',                   id: '1f_28pNdSUfc2RnwlcdVMaJM_03GbanQM', module: 3 },
      { filename: 'aula9_regionalizacao_br_espaco_amazonico.mp4',      id: '16y1YTMRLL4nV6eemEH2ROGyuiZMqmtWK', module: 3 },
      { filename: 'aula10_regionalizacao_br_ne_centro_sul.mp4',        id: '1EIDjfHRL9zN0Nn0SrcaX3n9fp3lYOGBi', module: 3 },
    ],
  },
  {
    subject: 'Direito Internacional',
    lessons: [
      // MÓDULO 1
      { filename: 'aula1_fundamentos.mp4',                id: '1tRSFvX2i3Oy7RKeZY7r5MJSFKqlABfVh', module: 1 },
      { filename: 'aula2_fontes_nao_convencionais.mp4',   id: '1k5KR27vi5SaGzjPweJOguS7r_K9KRzeq', module: 1 },
      { filename: 'aula3_direito_dos_tratados_p1.mp4',    id: '1UPYuPklLaZsanixDxbto_26S6ZM8GXMj', module: 1 },
      { filename: 'aula4_direito_dos_tratados_p2.mp4',    id: '1jFCkawzT6QOFych19WCYBabhCNU5Yin3', module: 1 },
      { filename: 'aula5_estados_p1.mp4',                 id: '12NQpcpRwvWw1nSRwOZRzHm3DgMp_L1ix', module: 1 },
      { filename: 'aula6_estados_p2.mp4',                 id: '13n6Pj5XNKsi6rGr6-89Ju6GNmmhICiQu', module: 1 },
      { filename: 'aula7_estados_p3.mp4',                 id: '1U2FEf7JEKFQxJZ0egzlZ6R3m-HyngaoX', module: 1 },
      { filename: 'aula8_revisao_simulado.mp4',           id: '18hrYfWBiNrcXNr6C2DmNPypiHD-GIMKG', module: 1 },
      // MÓDULO 2
      { filename: 'aula1_organizacoes_internacionais.mp4',         id: '1r9x7Gjhga2cpJz4PUOBuKdo3hN0YQyrN', module: 2 },
      { filename: 'aula2_idireitos_humanos.mp4',                   id: '1oqR1Y_mp4a05A1vCcmTMb9dWf_cUj08o', module: 2 },
      { filename: 'aula3_imunidade_Estado_Estrangeiro.mp4',        id: '1nhouOUJoifhty35hYss5aM5DS7AXFvsG', module: 2 },
      { filename: 'aula4_imunidades_diplomaticas_consulares.mp4',  id: '1-1ipYuz0bAsLV10OiHKQqo_1b1rbfM2I', module: 2 },
      { filename: 'aula5_resp_internacional.mp4',                  id: '19_HgPwQmCpPpHeD-qPghisC_893GFJ0P', module: 2 },
      { filename: 'aula6_solucao_de_controversias_p1.mp4',         id: '10PhMUsQvPBIEyF7tKBShYBgiwIJ8YY12', module: 2 },
      { filename: 'aula7_solucoes_de_controversias_p2.mp4',        id: '1p4av1Vjt41CbnSn885m2Sz_W0D9O6lfC', module: 2 },
      { filename: 'aula8_revisao_simulado.mp4',                    id: '1TtPUlDEVhz7Dkum_fswdTlwkiCPJrals', module: 2 },
      // MÓDULO 3
      { filename: 'aula1_meios_coercitivos_forca.mp4',                   id: '1_3t0U_D3AsyDO-cf_0RHSr6W95GRdFxT', module: 3 },
      { filename: 'aula2_sistema_seguranca_coletiva.mp4',                id: '1O_l4_spvvYqEMFI9xwRUhj0jd4L_bZPX', module: 3 },
      { filename: 'aula3_direito_internacional_penal.mp4',               id: '1oaXCkeTpkd1uBSGOGIeVr0P0HPm-Sqcx', module: 3 },
      { filename: 'aula4_direito_internacinal_refugiados.mp4',           id: '1YrBYUpstAQ2SkIMblF2Nya2sqidgGyh6', module: 3 },
      { filename: 'aula5_direito_internacional_economico_p1.mp4',        id: '11yZ7Dn-U8PnzETIZqHhLtKTjt2oJkg0U', module: 3 },
      { filename: 'aula6_direito_internacinal_economico_p2.mp4',         id: '1FMvaBV_V4gItzW45k5mYP_GzINqbnEb9', module: 3 },
      { filename: 'aula7_direito_internacional_economico_p3.mp4',        id: '1NdK5XfLdlycOU1PuF9V4qjAUFK0ERhiN', module: 3 },
      { filename: 'aula8_revisao_simulado.mp4',                          id: '1rGU50WXgnaJdctELZA-7YOBayqDRFsU4', module: 3 },
    ],
  },
  {
    subject: 'Política Internacional',
    lessons: [
      // MÓDULO 1
      { filename: 'aula1_ONU.mp4',                                        id: '1Sfk4X9y5Rg4BX948t4tKHjX901lvjac7', module: 1 },
      { filename: 'aula2_Operacoes_de_paz_p1.mp4',                       id: '14k6ynpoEPJKatM0xfRbBzbxfexMzlZ8d', module: 1 },
      { filename: 'aula3_operacoes_de_paz_p2.mp4',                       id: '1DgkjWuI0_OWPnMys1iwN_qi1DVqYROdV', module: 1 },
      { filename: 'aula4_terrorismo.mp4',                                 id: '1kyfmSlIj8vNimb3rT6yTg3xGmO3xLEF8', module: 1 },
      { filename: 'aula5_narcotrafico_crimes_internacionais_ciberneticos.mp4', id: '19vGtpHoWtQENo46Knn5T56gNF7SnhH8q', module: 1 },
      { filename: 'aula6_nao_proliferacao_nuclear.mp4',                  id: '1vAl78tdERJGt-NepYj5K6vJ8UZOjztME', module: 1 },
      { filename: 'aula7_meio_ambiente.mp4',                              id: '1Nzo7ROmHONZ5ceKV7D4uj6hm6eKykC8z', module: 1 },
      { filename: 'aula8_direitos_humanos.mp4',                           id: '1yCHM-Sj7UP5WPKb5reGiL8qVi68vqksv', module: 1 },
      { filename: 'aula9_comercio_internacional_1.mp4',                  id: '1Lbht8wSKew-d3eXbD81_k53h7OUAkrpw', module: 1 },
      { filename: 'aula10_comercio_internacional_2.mp4',                 id: '1rK86v9zW6olCefh7QkzGqkjNwkrsbuv_', module: 1 },
      { filename: 'aula11_sistema_financeiro_internacional.mp4',         id: '1wrX3_M4W_gzOIIiqWjYlAdjgHYkGM55E', module: 1 },
      // MÓDULO 2
      { filename: 'aula1_PEB_I.mp4',                                     id: '1si_80ac2x8LOOB5CGir__khHblSOEKWE', module: 2 },
      { filename: 'aula2_PEB_II.mp4',                                    id: '1Al-KXSmYLQKcfXuvHmZ4Z9jpBOZ9CDhD', module: 2 },
      { filename: 'aula3_PEB_III.mp4',                                   id: '1wSTR4MDtTiBXeB-XrJBIe5IEVnaLyt1O', module: 2 },
      { filename: 'aula4_PEB_IV.mp4',                                    id: '1PSe02eo4MTAe_r1JHAglRMPrSNXciwiT', module: 2 },
      { filename: 'aula5_PEB_V.mp4',                                     id: '1Fl8tl6t-SMqwqLHE_lWMQTIzPx0WtEGJ', module: 2 },
      { filename: 'aula6_relacoes_BR-ARG.mp4',                           id: '17QSMH_hpwAQXARof4MPqfCMSY2HDyPZH', module: 2 },
      { filename: 'aula7_relacoes_BR-EUA.mp4',                           id: '1i_kc3970PidEVhMLmKelxZjScCmxakcW', module: 2 },
      { filename: 'aula8_relacoes_BR-CHINA.mp4',                         id: '1RLzBD42HZiWj3gxTt-XWG3WOtNNJkD0I', module: 2 },
      { filename: 'aula9_relacoes_BR-INDIA.mp4',                         id: '1tAJCCE1apxbhoOYEldcSQit4zYrH7Shv', module: 2 },
      { filename: 'aula10_relacoes_BR-AMERICA_LATINA.mp4',               id: '18asP45DH33Ajq4JssJwM4-dvWmOB06yR', module: 2 },
      { filename: 'aula11_relacoes_BR-JAPAO_BR-RUSSIA.mp4',              id: '1k6_1sg5dHjODXfd2wPXduVbZDyanOvuM', module: 2 },
      { filename: 'aula12_relacoes_BR-Oriente_Medio-Africa.mp4',         id: '1AmVd8affkyZjMw03Y5tUhw95YmSwHOiW', module: 2 },
      // MÓDULO 3
      { filename: 'aula1_mercosul_p1.mp4',                               id: '1Dq6x3xk0dsMxC1ea8hc04kWDi-YO93pJ', module: 3 },
      { filename: 'aula2_mercosul_p2.mp4',                               id: '1vJbHcOizJLChHn6NNJEhXHANadmTuiZ7', module: 3 },
      { filename: 'aula3_integracoes_latino_americanas.mp4',             id: '1sWQAmw3Ih9Hu6_IuugozLZ3XyF_-Kh-x', module: 3 },
      { filename: 'aula4_integracao_da_europa_1.mp4',                    id: '1k3QKlUQfBqsni8BKvTOsOV5JLgTjuVA5', module: 3 },
      { filename: 'aula5_integracao_da_europa_2.mp4',                    id: '1tpBlWN53kPWudQIu6TsvAeXP7bSK-2c_', module: 3 },
      { filename: 'aula6_oriente_medio_1.mp4',                           id: '1YMXkCgCtHORiZbM2Onk0cjihiiyj8t7w', module: 3 },
      { filename: 'aula7_oriente_medio_2.mp4',                           id: '1AqWQQ7xAdAg7Vc3ha8yoAqmngl5fEvh6', module: 3 },
      { filename: 'aula8_oriente_medio_3.mp4',                           id: '1Xo5RHLo4C1pPiNjdcppnRGalYdxEoGin', module: 3 },
      { filename: 'aula9_oea_cplp_t.mp4',                                id: '15fucVlunR1CZ1zyCw-qaacFnTclncGE9', module: 3 },
      { filename: 'aula10_oteoria_das_relacoes_internacionais.mp4',      id: '1o1SjbGgT4PfZXWG1jBxD9KzNhdRJ4RZF', module: 3 },
      { filename: 'teoria_das_relacoes_internacionais_2.mp4',            id: '1DPAoUb2z7VtHm0wk_hqBzQybKaSHipTH', module: 3 },
    ],
  },
];

// ──────────────────────────────────────────────
//  MAIN
// ──────────────────────────────────────────────
async function main() {
  console.log('🎬 EduFlow — Importação de aulas do Google Drive\n');

  // Carregar matérias existentes
  const { data: subjects, error: subjectsErr } = await supabase
    .from('subjects')
    .select('id, name');
  if (subjectsErr) throw subjectsErr;

  const subjectMap = {};
  for (const s of subjects) {
    subjectMap[s.name.toLowerCase().trim()] = s.id;
  }

  let totalInserted = 0;
  let totalSkipped = 0;

  for (const entry of IMPORT_DATA) {
    const subjectId = subjectMap[entry.subject.toLowerCase().trim()];
    if (!subjectId) {
      console.warn(`⚠️  Matéria não encontrada: "${entry.subject}" — pulando.`);
      continue;
    }

    const rows = entry.lessons.map((l) => ({
      subject_id: subjectId,
      title: formatTitle(l.filename),
      drive_url: driveUrl(l.id),
      embed_url: embedUrl(l.id),
      order_index: aulaOrder(l.filename, l.module),
      duration_minutes: null,
    }));

    // Inserir em lotes de 50
    for (let i = 0; i < rows.length; i += 50) {
      const batch = rows.slice(i, i + 50);
      const { data, error } = await supabase
        .from('lessons')
        .upsert(batch, { onConflict: 'subject_id,drive_url', ignoreDuplicates: true })
        .select('id');
      if (error) {
        console.error(`Erro ao inserir aulas de "${entry.subject}":`, error.message);
      } else {
        totalInserted += data ? data.length : 0;
      }
    }
    console.log(`✅  ${entry.subject}: ${rows.length} aulas processadas`);
  }

  console.log(`\n🎉 Concluído! ${totalInserted} aulas inseridas.`);
}

main().catch((err) => {
  console.error('Erro fatal:', err);
  process.exit(1);
});

const REGRAS_OFERTA = {
    "2026/1": { "20261": [1], "20251": [2, 4, 6, 8] },
    "2026/2": { "20261": [2], "20251": [3, 5, 7] },
    "2027/1": { "20261": [1, 3], "20251": [4, 6, 8] },
    "2027/2": { "20261": [2, 4], "20251": [5, 7] },
    "2028/1": { "20261": [1, 3, 5], "20251": [6, 8] },
    "2028/2": { "20261": [2, 4, 6], "20251": [7] },
    "2029/1": { "20261": [1, 3, 5, 7], "20251": [8] },
    "2029/2": { "20261": [2, 4, 6, 8], "20251": [] }
};

const DB_KEY = 'UFMT_V9_2_FINAL';

let disciplinas = [];
let grade = JSON.parse(localStorage.getItem(DB_KEY)) || {};
let discSelecionada = null;

const horarios = [
    { id: "M1", label: "07:30 - 09:30" }, { id: "M2", label: "09:30 - 11:30" },
    { id: "T1", label: "13:30 - 15:30" }, { id: "T2", label: "15:30 - 17:30" }
];
const dias = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"];

async function carregarDados() {
    try {
        const res = await fetch('./data/disciplinas_obrigatorias.json?v=' + Date.now());
        disciplinas = await res.json();

        const pSel = document.getElementById('periodoAtual');
        Object.keys(REGRAS_OFERTA).forEach(p => {
            const opt = document.createElement('option');
            opt.value = p; opt.textContent = p;
            pSel.appendChild(opt);
        });

        const sSel = document.getElementById('filtroSemestre');
        for(let i=1; i<=8; i++) {
            let opt = document.createElement('option');
            opt.value = i; opt.textContent = i + "º Semestre";
            sSel.appendChild(opt);
        }
        salvarEAtualizar();
    } catch (e) { console.error("Erro no carregamento."); }
}

function sincronizarInterface() {
    const texto = document.getElementById('inputEtiquetas').value;
    const etiquetas = texto.split(',').map(s => s.trim().toUpperCase()).filter(s => s !== '');
    const selVinc = document.getElementById('selectVinc');
    const valorAtual = selVinc.value;

    selVinc.innerHTML = '<option value="GERAL">Todas as Turmas Atuais (Geral)</option>';
    etiquetas.forEach(et => {
        const opt = document.createElement('option');
        opt.value = et; opt.textContent = `Apenas: ${et}`;
        selVinc.appendChild(opt);
    });
    if([...selVinc.options].some(o => o.value === valorAtual)) selVinc.value = valorAtual;
    atualizarStatusCarga();
}

function getAulasDestaDisciplina() {
    if(!discSelecionada) return [];
    const ppc = document.getElementById('filtroPPC').value;
    const periodo = document.getElementById('periodoAtual').value;
    const lista = [];
    Object.values(grade).forEach(slot => {
        slot.forEach(aula => {
            if(aula.codigo === discSelecionada.codigo && aula.ppc === ppc && aula.periodo === periodo) {
                lista.push(aula);
            }
        });
    });
    return lista;
}

function atualizarStatusCarga() {
    if (!discSelecionada) return;
    const etiquetas = document.getElementById('inputEtiquetas').value.split(',').map(s => s.trim().toUpperCase()).filter(s => s !== '');
    const mT = parseInt(document.getElementById('metaT').value) || 0;
    const mP = parseInt(document.getElementById('metaP').value) || 0;

    const statusContainer = document.getElementById('statusCargaDinamica');
    statusContainer.innerHTML = '<strong>Saldo de Carga:</strong>';

    const aulas = getAulasDestaDisciplina();

    etiquetas.forEach(et => {
        const tCount = aulas.filter(a => a.tipo === 'Teórica' && (a.vinc === et || (a.vinc === 'GERAL' && a.snapshotEtiquetas.includes(et)))).length;
        const pCount = aulas.filter(a => a.tipo !== 'Teórica' && (a.vinc === et || (a.vinc === 'GERAL' && a.snapshotEtiquetas.includes(et)))).length;

        const line = document.createElement('div');
        line.className = 'status-line';
        line.innerHTML = `<span>${et}:</span> <span>T: ${tCount}/${mT} | P: ${pCount}/${mP}</span>`;
        statusContainer.appendChild(line);
    });
}

function alocarNaGrade(dia, horaId) {
    if (!discSelecionada) return alert("Selecione uma disciplina!");
    const periodo = document.getElementById('periodoAtual').value;
    const ppc = document.getElementById('filtroPPC').value;
    const etiquetas = document.getElementById('inputEtiquetas').value.split(',').map(s => s.trim().toUpperCase()).filter(s => s !== '');
    const vinc = document.getElementById('selectVinc').value;
    const tipo = document.getElementById('tipoAula').value;
    const mT = parseInt(document.getElementById('metaT').value) || 0;
    const mP = parseInt(document.getElementById('metaP').value) || 0;
    const limite = (tipo === 'Teórica' ? mT : mP);

    if (etiquetas.length === 0) return alert("Digite as turmas primeiro.");

    const aulasAtuais = getAulasDestaDisciplina();

    if (vinc === 'GERAL') {
        let cheias = etiquetas.filter(et => {
            const c = aulasAtuais.filter(a => a.tipo === tipo && (a.vinc === et || (a.vinc === 'GERAL' && a.snapshotEtiquetas.includes(et)))).length;
            return c >= limite;
        });
        if (cheias.length > 0) return alert(`BLOQUEIO: A turma ${cheias[0]} já atingiu o limite.`);
    } else {
        const count = aulasAtuais.filter(a => a.tipo === tipo && (a.vinc === vinc || (a.vinc === 'GERAL' && a.snapshotEtiquetas.includes(vinc)))).length;
        if (count >= limite) return alert(`BLOQUEIO: A turma ${vinc} já atingiu o limite.`);
    }

    const cellId = `${dia}-${horaId}`;
    if (!grade[cellId]) grade[cellId] = [];

    const prof = document.getElementById('profNome').value.trim() || "A definir";
    if (prof !== "A definir" && grade[cellId].some(a => a.prof === prof && a.periodo === periodo)) {
        return alert("O professor já tem aula neste horário.");
    }

    grade[cellId].push({
        uid: "U" + Math.random().toString(36).substr(2, 9),
        codigo: discSelecionada.codigo,
        nome: discSelecionada.nome,
        vinc: vinc,
        snapshotEtiquetas: etiquetas,
        tipo: tipo,
        ppc: ppc,
        periodo: periodo,
        prof: prof,
        semestre: document.getElementById('filtroSemestre').value
    });

    salvarEAtualizar();
}

function renderizarGrade() {
    const corpo = document.getElementById('corpoTabela');
    const periodo = document.getElementById('periodoAtual').value;
    corpo.innerHTML = '';
    horarios.forEach(h => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="hora-label"><strong>${h.label}</strong></td>`;
        dias.forEach(dia => {
            const cellId = `${dia}-${h.id}`;
            const td = document.createElement('td');
            const container = document.createElement('div');
            container.className = "container-cards";
            if (grade[cellId]) {
                grade[cellId].filter(a => a.periodo === periodo).forEach(aula => {
                    const card = document.createElement('div');
                    card.className = `aula-box semestre-${aula.semestre}`;
                    const tags = aula.vinc === 'GERAL' ? aula.snapshotEtiquetas.join(', ') : aula.vinc;

                    card.innerHTML = `
                        <span class="turma-tag">${tags}</span>
                        <strong>${aula.codigo}</strong>
                        <div style="font-size:0.6rem; font-weight:700; margin:2px 0;">${aula.nome}</div>
                        <div style="font-size:0.55rem; color:var(--primary); font-weight:600; border-top:1px dashed #ccc; padding-top:2px; margin-top:2px;">
                           👤 ${aula.prof}
                        </div>
                        <button class="btn-del" onclick="removerAula('${cellId}', '${aula.uid}')">×</button>
                    `;
                    container.appendChild(card);
                });
            }
            const btnAdd = document.createElement('button');
            btnAdd.className = "btn-adicionar-vaga"; btnAdd.innerHTML = "+";
            btnAdd.onclick = () => alocarNaGrade(dia, h.id);
            td.appendChild(container); td.appendChild(btnAdd); tr.appendChild(td);
        });
        corpo.appendChild(tr);
    });
}

function removerAula(cellId, uid) {
    grade[cellId] = grade[cellId].filter(a => a.uid !== uid);
    if (grade[cellId].length === 0) delete grade[cellId];
    salvarEAtualizar();
}

function renderizarMatrizResumo() {
    const periodo = document.getElementById('periodoAtual').value;
    ['20251', '20261'].forEach(ppc => {
        const container = document.getElementById(ppc === '20251' ? 'matriz2025' : 'matriz2026');
        container.innerHTML = '';
        if (!REGRAS_OFERTA[periodo] || !REGRAS_OFERTA[periodo][ppc]) return;

        REGRAS_OFERTA[periodo][ppc].forEach(sem => {
            const col = document.createElement('div');
            col.className = 'semestre-coluna';
            col.innerHTML = `<h4>${sem}º Sem.</h4>`;

            disciplinas.filter(d => d[`ppc_${ppc}`] == sem).forEach(d => {
                // VERIFICAÇÃO DE CONFIRMAÇÃO NO RODAPÉ (FIX)
                let temAula = false;
                Object.values(grade).forEach(slot => {
                    slot.forEach(a => {
                        // Corrigido para ignorar o filtro de semestre do cabeçalho e olhar apenas PPC/Período
                        if(a.codigo === d.codigo && a.periodo === periodo && a.ppc === ppc) temAula = true;
                    });
                });

                const item = document.createElement('div');
                item.className = `item-resumo ${temAula ? 'ok' : ''}`;
                item.innerHTML = `<span>${d.nome}</span> <span>${temAula ? '✅' : ''}</span>`;
                col.appendChild(item);
            });
            container.appendChild(col);
        });
    });
}

function carregarDisciplinas() {
    const ppc = document.getElementById('filtroPPC').value;
    const sem = document.getElementById('filtroSemestre').value;
    const periodo = document.getElementById('periodoAtual').value;
    const container = document.getElementById('listaDisciplinas');
    container.innerHTML = '';

    disciplinas.filter(d => d[`ppc_${ppc}`] == sem).forEach(d => {
        // VERIFICAÇÃO DE CONFIRMAÇÃO NA BARRA LATERAL
        let temAula = false;
        Object.values(grade).forEach(slot => {
            slot.forEach(a => {
                if(a.codigo === d.codigo && a.periodo === periodo && a.ppc === ppc) temAula = true;
            });
        });

        const div = document.createElement('div');
        div.className = `card-disc-item semestre-${sem} ${discSelecionada?.codigo === d.codigo ? 'active' : ''} ${temAula ? 'concluida' : ''}`;
        div.innerHTML = `<div><strong>${temAula ? '✅ ' : ''}${d.codigo}</strong><br><small>${d.nome}</small></div><span class="badge-ch">${d.carga_horaria}</span>`;
        div.onclick = () => selecionarDisciplina(d);
        container.appendChild(div);
    });
}

function selecionarDisciplina(d) {
    discSelecionada = d;
    document.getElementById('formConfig').style.display = 'block';
    document.getElementById('nomeDiscSelecionada').innerText = d.nome;
    document.getElementById('inputEtiquetas').value = "";
    document.getElementById('metaT').value = 1;
    document.getElementById('metaP').value = 1;
    sincronizarInterface();
    salvarEAtualizar();
}

function salvarEAtualizar() {
    localStorage.setItem(DB_KEY, JSON.stringify(grade));
    renderizarGrade();
    carregarDisciplinas();
    renderizarMatrizResumo();
    atualizarStatusCarga();
}

function resetAbsoluto() {
    if(confirm("Confirmar Reset TOTAL?")) { localStorage.clear(); grade = {}; location.reload(); }
}

carregarDados();
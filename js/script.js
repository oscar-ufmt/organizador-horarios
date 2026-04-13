const REGRAS_OFERTA = {
    "2026/1": { "20261": [1], "20251": [2, 4, 6, 8] },
    "2026/2": { "20261": [2], "20251": [3, 5, 7] },
    "2027/1": { "20261": [1, 3], "20251": [4, 6, 8] },
    "2027/2": { "20261": [2, 4], "20251": [5, 7] },
    "2028/1": { "20261": [1, 3, 5], "20251": [6, 8] },
    "2028/2": { "20261": [2, 4, 6], "20251": [7] },
    "2029/1": { "20261": [1, 3, 5, 7], "20251": [8] },
    "2029/2": { "20261": [2, 4, 6, 8], "20251": [] },
    "2030/1": { "20261": [1, 3, 5, 7], "20251": [] },
};

const DB_KEY = 'UFMT_SISTEMA_V12';
let disciplinas = [];
let optativas = [];
let grade = JSON.parse(localStorage.getItem(DB_KEY)) || {};
let discSelecionada = null;

const horarios = [
    { id: "M1", label: "07:30 - 09:30" }, { id: "M2", label: "09:30 - 11:30" },
    { id: "T1", label: "13:30 - 15:30" }, { id: "T2", label: "15:30 - 17:30" }
];
const dias = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"];

function getColorSemestre(s) {
    const cores = {
        1: "#e3f2fd", 2: "#f1f8e9", 3: "#fff3e0", 4: "#f3e5f5",
        5: "#efebe9", 6: "#e0f2f1", 7: "#fffde7", 8: "#ffebee"
    };
    return cores[s] || "#ffffff";
}

async function carregarDados() {
    try {
        const resOb = await fetch('./data/disciplinas_obrigatorias.json?v=' + Date.now());
        disciplinas = await resOb.json();

        const resOpt = await fetch('./data/disciplinas_optativas.json?v=' + Date.now());
        optativas = await resOpt.json();

        const pSel = document.getElementById('periodoAtual');
        pSel.innerHTML = '';
        Object.keys(REGRAS_OFERTA).forEach(p => {
            const opt = document.createElement('option');
            opt.value = p; opt.textContent = p;
            pSel.appendChild(opt);
        });

        const sSel = document.getElementById('filtroSemestre');
        sSel.innerHTML = '';
        for(let i=1; i<=8; i++) {
            let opt = document.createElement('option');
            opt.value = i; opt.textContent = i + "º Semestre";
            sSel.appendChild(opt);
        }

        popularDropdownOptativas();
        salvarEAtualizar();
    } catch (e) { console.error("Erro ao carregar arquivos JSON:", e); }
}

function popularDropdownOptativas() {
    const sel = document.getElementById('selectOptativas');
    sel.innerHTML = '<option value="">-- Selecione uma Optativa --</option>';
    optativas.sort((a,b) => a.nome.localeCompare(b.nome)).forEach(opt => {
        const o = document.createElement('option');
        o.value = opt.codigo;
        o.textContent = `${opt.codigo} - ${opt.nome}`;
        sel.appendChild(o);
    });
}

function sincronizarInterface() {
    const input = document.getElementById('inputEtiquetas');
    const selVinc = document.getElementById('selectVinc');
    if (!input || !selVinc) return;
    const etiquetas = input.value.split(',').map(s => s.trim().toUpperCase()).filter(s => s !== '');
    const valorSalvo = selVinc.value;
    selVinc.innerHTML = '<option value="GERAL">Todas as Turmas (Geral)</option>';
    etiquetas.forEach(et => {
        const opt = document.createElement('option');
        opt.value = et; opt.textContent = `Apenas Turma: ${et}`;
        selVinc.appendChild(opt);
    });
    if ([...selVinc.options].some(o => o.value === valorSalvo)) selVinc.value = valorSalvo;
}

function selecionarDisciplina(d) {
    discSelecionada = d;
    document.getElementById('selectOptativas').value = "";
    document.getElementById('formConfig').style.display = 'block';
    document.getElementById('nomeDiscSelecionada').innerText = d.nome;
    sincronizarInterface();
    renderizarGrade();
    carregarDisciplinas();
}

function selecionarOptativa(codigo) {
    if(!codigo) return;
    const disc = optativas.find(o => o.codigo === codigo);
    if(disc) {
        discSelecionada = disc;
        document.getElementById('formConfig').style.display = 'block';
        document.getElementById('nomeDiscSelecionada').innerText = `(OPTATIVA) ${disc.nome}`;
        sincronizarInterface();
        renderizarGrade();
        carregarDisciplinas();
    }
}

function alocarNaGrade(dia, horaId) {
    if (!discSelecionada) return alert("Selecione uma disciplina.");
    const periodo = document.getElementById('periodoAtual').value;
    const ppc = document.getElementById('filtroPPC').value;
    const sem = document.getElementById('filtroSemestre').value;
    const etiquetas = document.getElementById('inputEtiquetas').value.split(',').map(s => s.trim().toUpperCase()).filter(s => s !== '');
    const vinc = document.getElementById('selectVinc').value;
    const prof = document.getElementById('profNome').value.trim() || "A definir";
    const sala = document.getElementById('salaLocal').value.trim() || "S/N";

    if (etiquetas.length === 0) return alert("Defina as turmas.");

    const cellId = `${dia}-${horaId}`;

    if (grade[cellId]) {
        const conflitos = grade[cellId].filter(a => a.periodo === periodo);
        for (let aula of conflitos) {
            if (prof !== "A definir" && aula.prof === prof) {
                if (!confirm(`O professor ${prof} já está alocado aqui em ${aula.nome}. Continuar?`)) return;
            }
            if (aula.ppc === ppc && aula.semestre == sem && aula.codigo !== discSelecionada.codigo) {
                if (!confirm(`CHOQUE DE SEMESTRE: Alunos do ${sem}º semestre não podem cursar ${aula.nome} e ${discSelecionada.nome} ao mesmo tempo. Continuar?`)) return;
            }
            if (aula.codigo === discSelecionada.codigo) {
                const turmasOcupadas = aula.vinc === 'GERAL' ? aula.snapshotEtiquetas : [aula.vinc];
                const turmasNovas = vinc === 'GERAL' ? etiquetas : [vinc];
                if (turmasNovas.find(t => turmasOcupadas.includes(t))) {
                    if (!confirm(`Esta turma já possui aula desta disciplina neste horário. Continuar?`)) return;
                }
            }
        }
    }

    if (!grade[cellId]) grade[cellId] = [];
    grade[cellId].push({
        uid: "UID-" + Math.random().toString(36).substr(2, 9),
        codigo: discSelecionada.codigo,
        nome: discSelecionada.nome,
        vinc: vinc,
        snapshotEtiquetas: etiquetas,
        tipo: document.getElementById('tipoAula').value,
        ppc: ppc,
        periodo: periodo,
        prof: prof,
        sala: sala,
        semestre: sem
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
            container.className = 'container-cards';
            if (grade[cellId]) {
                grade[cellId].filter(a => a.periodo === periodo).forEach(aula => {
                    const card = document.createElement('div');
                    card.className = 'aula-box';
                    card.style.backgroundColor = getColorSemestre(aula.semestre);
                    card.style.borderLeft = "5px solid var(--primary)";
                    const tags = aula.vinc === 'GERAL' ? aula.snapshotEtiquetas.join(', ') : aula.vinc;
                    card.innerHTML = `
                        <span class="turma-tag">${tags}</span>
                        <strong>${aula.codigo}</strong>
                        <div style="font-size:0.6rem;">${aula.nome}</div>
                        <div onclick="editarAula('${cellId}', '${aula.uid}')" style="cursor:pointer; font-size:0.55rem; color:var(--primary); border-top:1px dashed #999; margin-top:3px;">
                           Prof: ${aula.prof} <br> Sala: ${aula.sala}
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

function editarAula(cellId, uid) {
    const aula = grade[cellId].find(a => a.uid === uid);
    if (!aula) return;
    const nP = prompt("Professor:", aula.prof);
    if (nP !== null) aula.prof = nP.trim() || "A definir";
    const nS = prompt("Sala:", aula.sala);
    if (nS !== null) aula.sala = nS.trim() || "S/N";
    salvarEAtualizar();
}

function removerAula(cellId, uid) {
    grade[cellId] = grade[cellId].filter(a => a.uid !== uid);
    salvarEAtualizar();
}

function carregarDisciplinas() {
    const ppc = document.getElementById('filtroPPC').value;
    const sem = document.getElementById('filtroSemestre').value;
    const container = document.getElementById('listaDisciplinas');
    container.innerHTML = '';
    disciplinas.filter(d => d[`ppc_${ppc}`] == sem).forEach(d => {
        const div = document.createElement('div');
        div.className = `card-disc-item ${discSelecionada?.codigo === d.codigo ? 'active' : ''}`;
        div.innerHTML = `<strong>${d.codigo}</strong><br><small>${d.nome}</small>`;
        div.onclick = () => selecionarDisciplina(d);
        container.appendChild(div);
    });
}

function renderizarMatrizResumo() {
    const periodo = document.getElementById('periodoAtual').value;
    ['20251', '20261'].forEach(ppc => {
        const container = document.getElementById(ppc === '20251' ? 'matriz2025' : 'matriz2026');
        container.innerHTML = '';
        if(!REGRAS_OFERTA[periodo] || !REGRAS_OFERTA[periodo][ppc]) return;
        REGRAS_OFERTA[periodo][ppc].forEach(s => {
            const col = document.createElement('div');
            col.innerHTML = `<strong>${s}º Sem</strong>`;
            disciplinas.filter(d => d[`ppc_${ppc}`] == s).forEach(d => {
                const ok = Object.values(grade).some(slot => slot.some(a => a.codigo === d.codigo && a.periodo === periodo));
                col.innerHTML += `<div class="item-resumo ${ok?'ok':''}">${d.nome.substring(0,20)} ${ok?'✅':''}</div>`;
            });
            container.appendChild(col);
        });
    });
}

function salvarEAtualizar() {
    localStorage.setItem(DB_KEY, JSON.stringify(grade));
    renderizarGrade(); carregarDisciplinas(); renderizarMatrizResumo();
}

function exportarJSON() {
    const blob = new Blob([JSON.stringify(grade, null, 2)], {type : 'application/json'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'grade_ufmt.json'; a.click();
}

function exportarExcel() {
    const periodo = document.getElementById('periodoAtual').value;
    const dados = [["Dia", "Horário", "Código", "Disciplina", "Professor", "Sala", "Turma", "Semestre", "PPC"]];
    Object.keys(grade).forEach(cellId => {
        const [dia, horaId] = cellId.split('-');
        grade[cellId].filter(a => a.periodo === periodo).forEach(a => {
            dados.push([dia, horaId, a.codigo, a.nome, a.prof, a.sala, a.vinc, a.semestre, a.ppc]);
        });
    });
    const ws = XLSX.utils.aoa_to_sheet(dados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Grade");
    XLSX.writeFile(wb, `Grade_${periodo.replace("/","-")}.xlsx`);
}

function importarJSON(input) {
    const reader = new FileReader();
    reader.onload = (e) => { grade = JSON.parse(e.target.result); salvarEAtualizar(); };
    reader.readAsText(input.files[0]);
}

function imprimirRelatorioCompleto() {
    const periodo = document.getElementById('periodoAtual').value;
    const relatorio = {};

    Object.keys(grade).forEach(cellId => {
        const [dia, horaId] = cellId.split('-');
        const hor = horarios.find(h => h.id === horaId)?.label || horaId;

        grade[cellId].filter(a => a.periodo === periodo).forEach(aula => {
            if (!relatorio[aula.ppc]) relatorio[aula.ppc] = {};
            if (!relatorio[aula.ppc][aula.semestre]) relatorio[aula.ppc][aula.semestre] = {};

            const chaveDisc = `${aula.codigo} - ${aula.nome}`;
            if (!relatorio[aula.ppc][aula.semestre][chaveDisc]) {
                relatorio[aula.ppc][aula.semestre][chaveDisc] = [];
            }

            relatorio[aula.ppc][aula.semestre][chaveDisc].push({
                dia, horario: hor, horaId: horaId, ...aula
            });
        });
    });

    const jan = window.open('', '', 'width=1300,height=900');

    let html = `<html><head><title>Relatório UFMT - ${periodo}</title><style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;800&display=swap');
        @page { size: landscape; margin: 1.5cm; }
        body { font-family: 'Inter', sans-serif; margin: 0; padding: 0; color: #1e293b; background: #fff; }
        .header-print { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #003d79; padding-bottom: 10px; }
        .header-print h1 { margin: 0; color: #003d79; font-size: 24pt; text-transform: uppercase; }
        .ppc-banner { background: #003d79; color: white; padding: 12px 20px; font-size: 16pt; font-weight: 800; border-radius: 4px; margin-bottom: 20px; }
        .semestre-header { background: #f1f5f9; padding: 10px 20px; font-size: 13pt; font-weight: 800; color: #003d79; border-left: 8px solid #003d79; margin-bottom: 15px; }
        .disciplina-card { margin: 0 0 20px 20px; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; }
        .disciplina-title { background: #f8fafc; padding: 12px 15px; font-size: 11pt; font-weight: 700; border-bottom: 1px solid #cbd5e1; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #f1f5f9; color: #475569; font-size: 9pt; text-transform: uppercase; padding: 12px 15px; text-align: left; border-bottom: 2px solid #cbd5e1; }
        td { padding: 12px 15px; font-size: 10.5pt; border-bottom: 1px solid #e2e8f0; }
        .turma-pill { background: #1e293b; color: white; padding: 4px 8px; border-radius: 4px; font-size: 9pt; font-weight: 800; }
        .no-print-btn { position: fixed; top: 20px; right: 20px; padding: 12px 24px; background: #003d79; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; z-index: 10000; }
        @media print { .no-print-btn { display: none; } .ppc-section { page-break-after: always; } }
    </style></head><body>`;

    html += `<button class="no-print-btn" onclick="window.print()">🖨️ GERAR RELATÓRIO PDF</button>`;
    html += `<div class="header-print"><h1>Universidade Federal de Mato Grosso</h1><p>Planejamento de Oferta Acadêmica - Período: ${periodo}</p></div>`;

    const ordemDias = { "Segunda": 1, "Terça": 2, "Quarta": 3, "Quinta": 4, "Sexta": 5 };

    Object.keys(relatorio).sort().forEach(ppcId => {
        const nomePPC = ppcId === '20261' ? "PPC NOVO (Currículo 2026/1)" : "PPC ANTIGO (Currículo 2025/1)";
        html += `<div class="ppc-section"><div class="ppc-banner">${nomePPC}</div>`;

        Object.keys(relatorio[ppcId]).sort((a,b) => a-b).forEach(sem => {
            html += `<div class="semestre-header">${sem}º SEMESTRE</div>`;
            Object.keys(relatorio[ppcId][sem]).sort().forEach(discKey => {
                const aulas = relatorio[ppcId][sem][discKey];
                html += `<div class="disciplina-card"><div class="disciplina-title" style="border-left: 12px solid ${getColorSemestre(sem)}">${discKey}</div>
                <table><thead><tr><th>Dia / Horário</th><th>Tipo</th><th>Turma(s)</th><th>Professor</th><th>Sala</th></tr></thead><tbody>`;

                aulas.sort((a, b) => {
                    if (ordemDias[a.dia] !== ordemDias[b.dia]) return ordemDias[a.dia] - ordemDias[b.dia];
                    return a.horaId.localeCompare(b.horaId);
                }).forEach(a => {
                    const turmas = a.vinc === 'GERAL' ? a.snapshotEtiquetas.join(', ') : a.vinc;
                    html += `<tr><td><strong>${a.dia}</strong> às ${a.horario}</td><td>${a.tipo}</td><td><span class="turma-pill">${turmas}</span></td><td>Prof: ${a.prof}</td><td>Sala: ${a.sala}</td></tr>`;                });
                html += `</tbody></table></div>`;
            });
        });
        html += `</div>`;
    });

    html += `</body></html>`;
    jan.document.write(html);
    jan.document.close();
}

function resetAbsoluto() { if(confirm("Apagar tudo?")) { localStorage.clear(); location.reload(); } }

carregarDados();
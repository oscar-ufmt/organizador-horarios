const REGRAS_OFERTA = {
    "2026/1": { "20261": [1], "20251": [2, 4, 6, 8] },
    "2026/2": { "20261": [2], "20251": [3, 5, 7] },
    "2027/1": { "20261": [1, 3], "20251": [4, 6, 8] },
    "2027/2": { "20261": [2, 4], "20251": [5, 7] }
};

const DB_KEY = 'UFMT_SISTEMA_V12';
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
        salvarEAtualizar();
    } catch (e) { console.error("Erro ao carregar disciplinas."); }
}

function sincronizarInterface() {
    const texto = document.getElementById('inputEtiquetas').value;
    const etiquetas = texto.split(',').map(s => s.trim().toUpperCase()).filter(s => s !== '');
    const selVinc = document.getElementById('selectVinc');
    const valorAtual = selVinc.value;

    selVinc.innerHTML = '<option value="GERAL">Todas as Turmas (Geral)</option>';
    etiquetas.forEach(et => {
        const opt = document.createElement('option');
        opt.value = et; opt.textContent = `Apenas Turma: ${et}`;
        selVinc.appendChild(opt);
    });
    if([...selVinc.options].some(o => o.value === valorAtual)) selVinc.value = valorAtual;
    atualizarStatusCarga();
}

function alocarNaGrade(dia, horaId) {
    if (!discSelecionada) return alert("Selecione uma disciplina lateral.");
    const periodo = document.getElementById('periodoAtual').value;
    const ppc = document.getElementById('filtroPPC').value;
    const sem = document.getElementById('filtroSemestre').value;
    const etiquetas = document.getElementById('inputEtiquetas').value.split(',').map(s => s.trim().toUpperCase()).filter(s => s !== '');
    const vinc = document.getElementById('selectVinc').value;
    const tipo = document.getElementById('tipoAula').value;

    if (etiquetas.length === 0) return alert("Defina as turmas (Ex: EC1).");

    const cellId = `${dia}-${horaId}`;
    if (!grade[cellId]) grade[cellId] = [];

    const prof = document.getElementById('profNome').value.trim() || "A definir";
    const sala = document.getElementById('salaLocal').value.trim() || "A definir";

    grade[cellId].push({
        uid: "UID-" + Math.random().toString(36).substr(2, 9),
        codigo: discSelecionada.codigo,
        nome: discSelecionada.nome,
        vinc: vinc,
        snapshotEtiquetas: etiquetas,
        tipo: tipo,
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
            container.className = "container-cards";

            if (grade[cellId]) {
                grade[cellId].filter(a => a.periodo === periodo).forEach(aula => {
                    const card = document.createElement('div');
                    card.className = `aula-box semestre-${aula.semestre}`;
                    const tags = aula.vinc === 'GERAL' ? aula.snapshotEtiquetas.join(', ') : aula.vinc;
                    card.innerHTML = `
                        <span class="turma-tag">${tags}</span>
                        <strong onclick="editarAula('${cellId}', '${aula.uid}')" style="cursor:pointer">${aula.codigo}</strong>
                        <div style="font-size:0.6rem; margin:2px 0;">${aula.nome}</div>
                        <div onclick="editarAula('${cellId}', '${aula.uid}')" style="font-size:0.55rem; color:var(--primary); cursor:pointer; border-top:1px dashed #ccc; padding-top:2px;">
                           👤 ${aula.prof} | 📍 ${aula.sala || 'S/N'}
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
    if(!aula) return;
    const novoProf = prompt("Nome do Professor:", aula.prof);
    if(novoProf !== null) aula.prof = novoProf.trim() || "A definir";
    const novaSala = prompt("Sala / Laboratório:", aula.sala);
    if(novaSala !== null) aula.sala = novaSala.trim() || "A definir";
    salvarEAtualizar();
}

function removerAula(cellId, uid) {
    if(!confirm("Remover esta aula?")) return;
    grade[cellId] = grade[cellId].filter(a => a.uid !== uid);
    if (grade[cellId].length === 0) delete grade[cellId];
    salvarEAtualizar();
}

// --- FUNÇÕES DE ARQUIVOS E RELATÓRIOS ---

function exportarJSON() {
    const blob = new Blob([JSON.stringify(grade, null, 2)], {type : 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'grade_ufmt.json'; a.click();
}

function importarJSON(input) {
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            grade = JSON.parse(e.target.result);
            salvarEAtualizar();
            alert("Grade carregada!");
        } catch(err) { alert("Erro no arquivo."); }
    };
    reader.readAsText(file);
}

function exportarExcel() {
    const periodo = document.getElementById('periodoAtual').value;
    const dados = [["Dia", "Horário", "Semestre", "Código", "Disciplina", "Turmas", "Professor", "Sala"]];
    Object.keys(grade).forEach(id => {
        const [dia, horaId] = id.split('-');
        grade[id].filter(a => a.periodo === periodo).forEach(a => {
            dados.push([dia, horaId, a.semestre, a.codigo, a.nome, a.vinc, a.prof, a.sala]);
        });
    });
    const ws = XLSX.utils.aoa_to_sheet(dados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Grade");
    XLSX.writeFile(wb, `Grade_UFMT_${periodo.replace('/','-')}.xlsx`);
}

function imprimirRelatorioSemestre() {
    const sem = document.getElementById('filtroSemestre').value;
    const periodo = document.getElementById('periodoAtual').value;
    const janela = window.open('', '', 'width=800,height=600');
    let html = `<h2>Relatório ${sem}º Semestre - ${periodo}</h2><table border="1" style="width:100%; border-collapse:collapse;"><tr><th>Dia/Hora</th><th>Disciplina</th><th>Professor</th><th>Sala</th></tr>`;

    Object.keys(grade).forEach(id => {
        grade[id].filter(a => a.semestre == sem && a.periodo == periodo).forEach(a => {
            html += `<tr><td>${id}</td><td>${a.nome}</td><td>${a.prof}</td><td>${a.sala}</td></tr>`;
        });
    });
    janela.document.write(html + "</table><script>window.print();</script>");
}

// --- UTILITÁRIOS ---

function salvarEAtualizar() {
    localStorage.setItem(DB_KEY, JSON.stringify(grade));
    renderizarGrade(); carregarDisciplinas(); renderizarMatrizResumo();
}

function carregarDisciplinas() {
    const ppc = document.getElementById('filtroPPC').value;
    const sem = document.getElementById('filtroSemestre').value;
    const periodo = document.getElementById('periodoAtual').value;
    const container = document.getElementById('listaDisciplinas');
    container.innerHTML = '';
    disciplinas.filter(d => d[`ppc_${ppc}`] == sem).forEach(d => {
        const temAula = Object.values(grade).some(slot => slot.some(a => a.codigo === d.codigo && a.ppc === ppc && a.periodo === periodo));
        const div = document.createElement('div');
        div.className = `card-disc-item semestre-${sem} ${discSelecionada?.codigo === d.codigo ? 'active' : ''} ${temAula ? 'concluida' : ''}`;
        div.innerHTML = `<div><strong>${d.codigo}</strong><br><small>${d.nome}</small></div>`;
        div.onclick = () => { discSelecionada = d; document.getElementById('formConfig').style.display='block'; document.getElementById('nomeDiscSelecionada').innerText=d.nome; salvarEAtualizar(); };
        container.appendChild(div);
    });
}

function renderizarMatrizResumo() {
    const periodo = document.getElementById('periodoAtual').value;
    ['20251', '20261'].forEach(ppc => {
        const container = document.getElementById(ppc === '20251' ? 'matriz2025' : 'matriz2026');
        container.innerHTML = '';
        if(!REGRAS_OFERTA[periodo][ppc]) return;
        REGRAS_OFERTA[periodo][ppc].forEach(s => {
            const col = document.createElement('div');
            col.innerHTML = `<strong>${s}º Sem</strong>`;
            disciplinas.filter(d => d[`ppc_${ppc}`] == s).forEach(d => {
                const ok = Object.values(grade).some(slot => slot.some(a => a.codigo === d.codigo && a.periodo === periodo));
                col.innerHTML += `<div class="item-resumo ${ok?'ok':''}">${d.nome} ${ok?'✅':''}</div>`;
            });
            container.appendChild(col);
        });
    });
}

function atualizarStatusCarga() { /* Implementar conforme necessidade de cálculo de slots */ }

function resetAbsoluto() { if(confirm("Apagar tudo?")) { localStorage.clear(); location.reload(); } }

carregarDados();
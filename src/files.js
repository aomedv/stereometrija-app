const API_URL = "https://ci276990.tw1.ru";

let currentFiles = [], selectedFileId = null, isGuestMode = "true" === localStorage.getItem("guestMode");

function parseServerResponse(text) {
    try {
        return JSON.parse(text);
    } catch (e) {
        const lastBraceIndex = text.lastIndexOf("{");
        if (-1 !== lastBraceIndex) try {
            const jsonPart = text.substring(lastBraceIndex);
            return JSON.parse(jsonPart);
        } catch (e2) {
            const firstBraceIndex = text.indexOf("{");
            if (-1 !== firstBraceIndex) try {
                return JSON.parse(text.substring(firstBraceIndex));
            } catch (e3) {
                const allBraces = [];
                for (let i = 0; i < text.length; i++) {
                    if ("{" === text[i]) {
                        allBraces.push(i);
                    }
                }
                for (let i = allBraces.length - 1; i >= 0; i--) try {
                    return JSON.parse(text.substring(allBraces[i]));
                } catch (e4) {
                    continue;
                }
            }
        }
        return {
            success: !1,
            message: "серверная ошибка"
        };
    }
}

async function checkAuth() {
    if (!isGuestMode) try {
        const response = await fetch(`${API_URL}/check_session.php`, {
            credentials: "include"
        });
        if (!(await response.json()).loggedIn) {
            window.location.href = "auth.html";
        }
    } catch (error) {
        window.location.href = "auth.html";
    }
}

checkAuth();

const filesList = document.getElementById("files-list"), selectedFileActions = document.getElementById("selected-file-actions"), modal = document.getElementById("modal"), modalTitle = document.getElementById("modal-title"), modalBody = document.getElementById("modal-body"), modalClose = document.getElementById("modal-close");

function closeModal() {
    modal.classList.remove("active");
    modal.classList.add("hidden");
}

function openModal(title, content) {
    modalTitle.textContent = title;
    modalBody.innerHTML = content;
    modal.classList.remove("hidden");
    modal.classList.add("active");
}

async function loadFiles() {
    const localFiles = loadLocalFiles();
    if (isGuestMode) currentFiles = localFiles; else {
        const serverFiles = await loadServerFiles();
        currentFiles = [ ...localFiles, ...serverFiles ];
    }
    renderFiles();
}

function loadLocalFiles() {
    const localFilesData = localStorage.getItem("localFiles");
    return (localFilesData ? JSON.parse(localFilesData) : []).map(f => ({
        ...f,
        isLocal: !0
    }));
}

function saveLocalFiles() {
    const localFiles = currentFiles.filter(f => f.isLocal);
    localStorage.setItem("localFiles", JSON.stringify(localFiles));
}

async function loadServerFiles() {
    try {
        const response = await fetch(`${API_URL}/get_files.php`, {
            credentials: "include"
        }), data = parseServerResponse(await response.text());
        if (data.success) {
            return data.files.map(f => ({
                ...f,
                isLocal: !1
            }));
        } else {
            alert(data.message);
            return [];
        }
    } catch (error) {
        alert(error.message);
        return [];
    }
}

function renderFiles() {
    filesList.innerHTML = "";
    if (0 !== currentFiles.length) {
        currentFiles.forEach(file => {
        const fileItem = document.createElement("div"), isSelected = file.id === selectedFileId;
        fileItem.className = "bg-white rounded-lg p-5 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer border-2 " + (isSelected ? "border-[#667eea] ring-2 ring-[#d6e0ff]" : "border-transparent hover:border-gray-200"), 
        fileItem.dataset.fileId = file.id;
        const date = new Date(file.updated_at || file.created_at), dateStr = date.toLocaleDateString("ru-RU", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }), timeStr = date.toLocaleTimeString("ru-RU", {
            hour: "2-digit",
            minute: "2-digit"
        }), statusBadge = file.isLocal ? '<span class="file-status offline">Офлайн</span>' : '<span class="file-status online">Онлайн</span>';
        fileItem.innerHTML = `<div class="flex items-start justify-between mb-3"><div class="flex-1 min-w-0"><h3 class="text-lg font-semibold text-gray-900 truncate mb-1">${file.name}</h3>${statusBadge}</div><svg class="w-10 h-10 text-gray-300 flex-shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg></div><div class="flex items-center text-sm text-gray-500"><svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>${dateStr} в ${timeStr}</div>`;
        fileItem.addEventListener("click", e => {
            if (1 === e.detail) {
                selectFile(file.id);
            } else if (2 === e.detail) {
                openFile(file.id);
            }
        });
        filesList.appendChild(fileItem);
    });
    } else {
        filesList.innerHTML = '<div class="col-span-full flex flex-col items-center justify-center py-16"><svg class="w-24 h-24 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg><h3 class="text-xl font-semibold text-gray-600 mb-2">Нет файлов</h3><p class="text-gray-400">Создайте свой первый файл</p></div>';
    }
}

function selectFile(fileId) {
    if (selectedFileId === fileId) {
        selectedFileId = null;
        selectedFileActions.classList.add("hidden");
    } else {
        selectedFileId = fileId;
        selectedFileActions.classList.remove("hidden");
    }
    renderFiles();
}

function openFile(fileId) {
    const file = currentFiles.find(f => f.id === fileId);
    if (file) {
        localStorage.setItem("currentFileId", fileId);
        localStorage.setItem("currentFileIsLocal", file.isLocal ? "true" : "false");
        window.location.href = "index.html";
    }
}

async function createFile() {
    const name = document.getElementById("new-file-name").value.trim();
    if (name) if (isGuestMode) {
        const newFile = {
            id: Date.now(),
            name: name,
            content: "",
            created_at: (new Date).toISOString(),
            updated_at: (new Date).toISOString(),
            isLocal: !0
        };
        currentFiles.push(newFile);
        saveLocalFiles();
        closeModal();
        renderFiles();
    } else try {
        const response = await fetch(`${API_URL}/create_file.php`, {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                name: name
            })
        }), data = parseServerResponse(await response.text());
        if (data.success) {
            closeModal();
            await loadFiles();
        } else {
            alert(data.message);
        }
    } catch (error) {
        alert(error.message);
    } else {
        alert("Введите название файла");
    }
}

async function renameFile() {
    const name = document.getElementById("rename-file-name").value.trim();
    if (!name) {
        alert("Введите название файла");
        return;
    }
    const file = currentFiles.find(f => f.id === selectedFileId);
    if (file) {
        if (file.isLocal) {
            file.name = name;
            file.updated_at = (new Date).toISOString();
            saveLocalFiles();
            closeModal();
            renderFiles();
        } else {
            try {
        const response = await fetch(`${API_URL}/update_file.php`, {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                fileId: selectedFileId,
                name: name
            })
        }), data = parseServerResponse(await response.text());
        if (data.success) {
            closeModal();
            await loadFiles();
        } else {
            alert(data.message);
        }
    } catch (error) {
        alert(error.message);
    }
        }
    }
}

async function exportFile(file) {
    try {
        let fileData = {
            ...file
        };
        if (!file.isLocal && !file.content) {
            const response = await fetch(`${API_URL}/get_file.php?fileId=${file.id}`, {
                credentials: "include"
            }), data = parseServerResponse(await response.text());
            if (data.success && data.file) {
                fileData = {
                    id: file.id,
                    name: file.name,
                    content: data.file.content,
                    created_at: file.created_at,
                    updated_at: file.updated_at
                };
            }
        }
        const fileName = document.getElementById("export-file-name").value.trim() || `${file.name}.json`, dataStr = JSON.stringify(fileData, null, 2), dataBlob = new Blob([ dataStr ], {
            type: "application/json"
        }), url = URL.createObjectURL(dataBlob), link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 100);
        closeModal();
        alert(`Файл "${fileName}" сохранен в папку "Загрузки"`);
    } catch (error) {
        alert(error.message);
    }
}

async function deleteFile() {
    const file = currentFiles.find(f => f.id === selectedFileId);
    if (file) {
        if (file.isLocal) {
            currentFiles = currentFiles.filter(f => f.id !== selectedFileId);
            saveLocalFiles();
            selectedFileId = null;
            selectedFileActions.classList.add("hidden");
            closeModal();
            renderFiles();
        } else {
            try {
        const response = await fetch(`${API_URL}/delete_file.php`, {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                fileId: selectedFileId
            })
        }), data = parseServerResponse(await response.text());
        if (data.success) {
            selectedFileId = null;
            selectedFileActions.classList.add("hidden");
            closeModal();
            await loadFiles();
        } else {
            alert(data.message);
        }
    } catch (error) {
        alert(error.message);
    }
        }
    }
}

document.getElementById("file-menu-btn").addEventListener("click", e => {
    e.stopPropagation();
    document.getElementById("file-dropdown").classList.toggle("active");
});

document.addEventListener("click", () => {
    document.getElementById("file-dropdown").classList.remove("active");
});

document.getElementById("logout-btn").addEventListener("click", async e => {
    e.preventDefault();
    if (!isGuestMode) {
        await fetch(`${API_URL}/logout.php`, {
            credentials: "include"
        });
    }
    localStorage.removeItem("loggedIn");
    localStorage.removeItem("guestMode");
    localStorage.removeItem("currentFileId");
    window.location.href = "auth.html";
});

modalClose.addEventListener("click", closeModal);

modal.addEventListener("click", e => {
    if (e.target === modal) {
        closeModal();
    }
});

document.getElementById("create-file-btn").addEventListener("click", () => {
    openModal("Создать файл", '<input type="text" id="new-file-name" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#667eea] focus:border-transparent outline-none transition-all" placeholder="Название файла"><button class="w-full bg-[#667eea] hover:bg-[#5568d3] text-white font-semibold py-3 rounded-lg transition-colors duration-200 mt-4" id="create-file-submit">Создать</button>\n    ');
    document.getElementById("create-file-submit").addEventListener("click", createFile);
});

document.getElementById("import-file-btn").addEventListener("click", () => {
    const input = document.createElement("input");
    input.type = "file", input.accept = ".json", input.addEventListener("change", async e => {
        const file = e.target.files[0];
        if (file) try {
            const text = await file.text(), importedData = JSON.parse(text);
            if (!importedData.name) {
                alert('Неверный формат файла: отсутствует поле "name"');
                return;
            }
            const newFile = {
                id: Date.now(),
                name: importedData.name,
                content: importedData.content || "",
                created_at: (new Date).toISOString(),
                updated_at: (new Date).toISOString(),
                isLocal: !0
            };
            currentFiles.push(newFile);
            saveLocalFiles();
            renderFiles();
            alert(`Файл "${newFile.name}" успешно импортирован`);
        } catch (error) {
            alert(error.message);
        }
    });
    input.click();
});

document.getElementById("rename-file-btn").addEventListener("click", () => {
    if (!selectedFileId) return;
    const file = currentFiles.find(f => f.id === selectedFileId);
    if (file) {
        openModal("Изменить название", `<input type="text" id="rename-file-name" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#667eea] focus:border-transparent outline-none transition-all" value="${file.name}"><button class="w-full bg-[#667eea] hover:bg-[#5568d3] text-white font-semibold py-3 rounded-lg transition-colors duration-200 mt-4" id="rename-file-submit">Сохранить</button>\n    `);
        document.getElementById("rename-file-submit").addEventListener("click", renameFile);
    }
});

document.getElementById("export-file-btn").addEventListener("click", () => {
    if (!selectedFileId) return;
    const file = currentFiles.find(f => f.id === selectedFileId);
    if (file) {
        openModal("Экспорт файла", `<input type="text" id="export-file-name" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#667eea] focus:border-transparent outline-none transition-all" value="${file.name}.json"><button class="w-full bg-[#667eea] hover:bg-[#5568d3] text-white font-semibold py-3 rounded-lg transition-colors duration-200 mt-4" id="export-file-submit">Экспортировать</button>\n    `);
        setTimeout(() => {
            document.getElementById("export-file-submit")?.addEventListener("click", () => exportFile(file));
        }, 0);
    }
});

document.getElementById("delete-file-btn").addEventListener("click", () => {
    if (!selectedFileId) return;
    const file = currentFiles.find(f => f.id === selectedFileId);
    if (file) {
        openModal("Удалить файл", `<p class="text-gray-600 mb-6">Вы уверены, что хотите удалить файл "${file.name}"?</p><div class="flex gap-3"><button class="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold py-3 rounded-lg transition-colors duration-200" id="delete-file-confirm">Удалить</button><button class="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-3 rounded-lg transition-colors duration-200" id="delete-file-cancel">Отмена</button></div>\n    `);
        document.getElementById("delete-file-confirm").addEventListener("click", deleteFile);
        document.getElementById("delete-file-cancel").addEventListener("click", closeModal);
    }
});

document.getElementById("user-info").textContent = isGuestMode ? "Гостевой режим" : "Авторизован";

loadFiles();
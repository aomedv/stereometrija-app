const API_URL = "https://ci276990.tw1.ru";

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

class FileStorage {
    constructor() {
        this.isGuestMode = "true" === localStorage.getItem("guestMode");
        this.currentFileId = localStorage.getItem("currentFileId");
        this.currentFileIsLocal = "true" === localStorage.getItem("currentFileIsLocal");
    }
    async saveCurrentFile(content) {
        return this.currentFileId ? this.currentFileIsLocal ? this.saveLocalFile(content) : this.saveServerFile(content) : {
            success: !1,
            message: "Файл не выбран"
        };
    }
    saveLocalFile(content) {
        const localFiles = JSON.parse(localStorage.getItem("localFiles") || "[]");
        const fileIndex = localFiles.findIndex(f => f.id == this.currentFileId);
        if (fileIndex >= 0) {
            localFiles[fileIndex].content = JSON.stringify(content);
            localFiles[fileIndex].updated_at = (new Date).toISOString();
            localStorage.setItem("localFiles", JSON.stringify(localFiles));
            return {
                success: !0
            };
        } else {
            return {
                success: !1,
                message: "Файл не найден"
            };
        }
    }
    async saveServerFile(content) {
        try {
            const response = await fetch(`${API_URL}/update_file.php`, {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    fileId: this.currentFileId,
                    content: JSON.stringify(content)
                })
            });
            return parseServerResponse(await response.text());
        } catch (error) {
            return {
                success: !1,
                message: error.message
            };
        }
    }
    async loadCurrentFile() {
        return this.currentFileId ? this.currentFileIsLocal ? this.loadLocalFile() : this.loadServerFile() : {
            success: !1,
            message: "Файл не выбран"
        };
    }
    loadLocalFile() {
        const file = JSON.parse(localStorage.getItem("localFiles") || "[]").find(f => f.id == this.currentFileId);
        if (file) try {
            const content = file.content ? JSON.parse(file.content) : {};
            return {
                success: !0,
                file: {
                    ...file,
                    content: content
                }
            };
        } catch {
            return {
                success: !0,
                file: {
                    ...file,
                    content: {}
                }
            };
        }
        return {
            success: !1,
            message: "Файл не найден"
        };
    }
    async loadServerFile() {
        try {
            const response = await fetch(`${API_URL}/get_file.php?fileId=${this.currentFileId}`, {
                credentials: "include"
            }), data = parseServerResponse(await response.text());
            if (data.success && data.file) try {
                data.file.content = data.file.content ? JSON.parse(data.file.content) : {};
            } catch {
                data.file.content = {};
            }
            return data;
        } catch (error) {
            return {
                success: !1,
                message: error.message
            };
        }
    }
    getCurrentFileName() {
        const file = JSON.parse(localStorage.getItem("localFiles") || "[]").find(f => f.id == this.currentFileId);
        return file ? file.name : "Файл";
    }
}

window.FileStorage = FileStorage;
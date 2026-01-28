const API_URL = "https://ci276990.tw1.ru";

let currentUserId = null;
let currentEmail = null;
let resetAttempts = 5;

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
            message: "Ошибка (серверр)."
        };
    }
}

async function checkSession() {
    try {
        const response = await fetch(`${API_URL}/check_session.php`, {
            credentials: "include"
        });
        if ((await response.json()).loggedIn) {
            window.location.href = "files.html";
        }
    } catch (error) {}
}

checkSession();

const loginForm = document.getElementById("login-form"), registerForm = document.getElementById("register-form"), verifyEmailForm = document.getElementById("verify-email-form"), forgotPasswordForm = document.getElementById("forgot-password-form"), verifyResetForm = document.getElementById("verify-reset-form"), newPasswordForm = document.getElementById("new-password-form");

document.getElementById("show-register-btn").addEventListener("click", () => {
    loginForm.classList.add("hidden");
    registerForm.classList.remove("hidden");
});

document.getElementById("show-login-btn").addEventListener("click", () => {
    registerForm.classList.add("hidden");
    loginForm.classList.remove("hidden");
});

document.getElementById("forgot-password-btn").addEventListener("click", () => {
    loginForm.classList.add("hidden");
    forgotPasswordForm.classList.remove("hidden");
});

document.getElementById("back-to-login-btn").addEventListener("click", () => {
    forgotPasswordForm.classList.add("hidden");
    loginForm.classList.remove("hidden");
});

document.getElementById("continue-without-auth-btn").addEventListener("click", () => {
    localStorage.setItem("guestMode", "true");
    window.location.href = "files.html";
});

document.getElementById("login-btn").addEventListener("click", async () => {
    const username = document.getElementById("login-username").value.trim();
    const password = document.getElementById("login-password").value;
    const errorEl = document.getElementById("login-error");
    errorEl.textContent = "";
    if (username && password) {
        try {
            const response = await fetch(`${API_URL}/login.php`, {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    username: username,
                    password: password
                })
            }), data = parseServerResponse(await response.text());
            if (data.success) {
                localStorage.setItem("loggedIn", "true");
                localStorage.removeItem("guestMode");
                window.location.href = "files.html";
            } else {
                errorEl.textContent = data.message;
            }
        } catch (error) {
            errorEl.textContent = "Ошибка: " + error.message;
        }
    } else {
        errorEl.textContent = "Заполните все поля";
    }
});

document.getElementById("register-btn").addEventListener("click", async () => {
    const username = document.getElementById("register-username").value.trim();
    const password = document.getElementById("register-password").value;
    const email = document.getElementById("register-email").value.trim();
    const errorEl = document.getElementById("register-error");
    errorEl.textContent = "";
    if (username && password && email) {
        try {
            const response = await fetch(`${API_URL}/register.php`, {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    username: username,
                    password: password,
                    email: email
                })
            }), data = parseServerResponse(await response.text());
            if (data.success) {
                currentUserId = data.userId;
                registerForm.classList.add("hidden");
                verifyEmailForm.classList.remove("hidden");
            } else {
                errorEl.textContent = data.message;
            }
        } catch (error) {
            errorEl.textContent = "Ошибка: " + error.message;
        }
    } else {
        errorEl.textContent = "Заполните все поля";
    }
});

document.getElementById("verify-btn").addEventListener("click", async () => {
    const code = document.getElementById("verify-code").value.trim();
    const errorEl = document.getElementById("verify-error");
    errorEl.textContent = "";
    if (6 === code.length) {
        try {
            const response = await fetch(`${API_URL}/verify_email.php`, {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    userId: currentUserId,
                    code: code
                })
            }), data = parseServerResponse(await response.text());
            if (data.success) {
                localStorage.setItem("loggedIn", "true");
                localStorage.removeItem("guestMode");
                window.location.href = "files.html";
            } else {
                errorEl.textContent = data.message;
            }
        } catch (error) {
            errorEl.textContent = "Ошибка: " + error.message;
        }
    } else {
        errorEl.textContent = "Введите 6-значный код";
    }
});

document.getElementById("forgot-submit-btn").addEventListener("click", async () => {
    const email = document.getElementById("forgot-email").value.trim();
    const errorEl = document.getElementById("forgot-error");
    errorEl.textContent = "";
    if (email) {
        try {
            const response = await fetch(`${API_URL}/forgot_password.php`, {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    email: email
                })
            }), data = parseServerResponse(await response.text());
            if (data.success) {
                currentEmail = email;
                resetAttempts = 5;
                forgotPasswordForm.classList.add("hidden");
                verifyResetForm.classList.remove("hidden");
                document.getElementById("attempts-info").textContent = `Попыток осталось: ${resetAttempts}`;
            } else {
                errorEl.textContent = data.message;
            }
        } catch (error) {
            errorEl.textContent = "Ошибка: " + error.message;
        }
    } else {
        errorEl.textContent = "Введите email";
    }
});

document.getElementById("verify-reset-btn").addEventListener("click", async () => {
    const code = document.getElementById("reset-code").value.trim();
    const errorEl = document.getElementById("reset-code-error");
    errorEl.textContent = "";
    if (8 === code.length) {
        try {
            const response = await fetch(`${API_URL}/verify_reset_code.php`, {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    email: currentEmail,
                    code: code
                })
            }), data = parseServerResponse(await response.text());
            if (data.success) {
                verifyResetForm.classList.add("hidden");
                newPasswordForm.classList.remove("hidden");
            } else if (data.limit_reached || data.expired) {
                verifyResetForm.classList.add("hidden");
                forgotPasswordForm.classList.remove("hidden");
                document.getElementById("forgot-error").textContent = data.message;
            } else {
                resetAttempts--;
                document.getElementById("attempts-info").textContent = `Попыток осталось: ${resetAttempts}`;
                errorEl.textContent = data.message;
            }
        } catch (error) {
            errorEl.textContent = "Ошибка: " + error.message;
        }
    } else {
        errorEl.textContent = "Введите 8-значный код";
    }
});

document.getElementById("reset-password-btn").addEventListener("click", async () => {
    const newPassword = document.getElementById("new-password").value;
    const confirmPassword = document.getElementById("new-password-confirm").value;
    const code = document.getElementById("reset-code").value.trim();
    const errorEl = document.getElementById("new-password-error");
    errorEl.textContent = "";
    if (newPassword && confirmPassword) {
        if (newPassword === confirmPassword) {
            try {
                const response = await fetch(`${API_URL}/reset_password.php`, {
                    method: "POST",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        email: currentEmail,
                        code: code,
                        newPassword: newPassword
                    })
                }), data = parseServerResponse(await response.text());
                if (data.success) {
                    localStorage.setItem("loggedIn", "true");
                    localStorage.removeItem("guestMode");
                    window.location.href = "files.html";
                } else {
                    errorEl.textContent = data.message;
                }
            } catch (error) {
                errorEl.textContent = "Ошибка: " + error.message;
            }
        } else {
            errorEl.textContent = "Пароли не совпадают";
        }
    } else {
        errorEl.textContent = "Заполните все поля";
    }
});
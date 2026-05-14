import { Eye, PackageCheck, User, Lock, LogIn } from "lucide-react";
import "./Login.css";
import { useState } from "react";
import { validarUsuario } from "../services/ordenesApi";

export default function Login() {
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [mostrarPassword, setMostrarPassword] = useState(false);

  const iniciarSesion = async (e: React.FormEvent) => {
    e.preventDefault();

    const ok = await validarUsuario(usuario, password);

    if (!ok) {
      alert("Usuario o contraseña incorrectos");
      return;
    }

    localStorage.setItem("alisto-user", usuario.trim());
    window.location.href = "/";
  };

  return (
    <div className="login-page">
      <div className="login-bg-shape shape-one" />
      <div className="login-bg-shape shape-two" />
      <div className="login-dots dots-top" />
      <div className="login-dots dots-bottom" />

      <div className="login-container">
        <div className="login-left">
          <div className="logo-box">
            <div className="logo-icon">
              <PackageCheck size={78} />
            </div>

            <h1 className="logo-title">Sistema de Alisto</h1>
            <p className="logo-subtitle">Gestión de Pedidos y Entregas</p>
          </div>

          <div className="login-divider">
            <span>Inicia sesión para continuar</span>
          </div>

          <form onSubmit={iniciarSesion}>
            <div className="login-form-group">
              <label>Usuario</label>
              <div className="login-input-wrapper">
                <User className="login-input-icon" size={24} />
                <input
                  className="login-input"
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  placeholder="Ingresa tu usuario"
                />
              </div>
            </div>

            <div className="login-form-group">
              <label>Contraseña</label>
              <div className="login-input-wrapper">
                <Lock className="login-input-icon" size={24} />
                <input
                  className="login-input"
                  type={mostrarPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ingresa tu contraseña"
                />
                <Eye
                  className="login-eye"
                  size={24}
                  onClick={() => setMostrarPassword(!mostrarPassword)}
                />
              </div>
            </div>

            <div className="login-options">
              <label className="login-remember">
                <input type="checkbox" defaultChecked />
                <span>Recordarme</span>
              </label>

              
            </div>

            <button className="login-button" type="submit">
              <LogIn size={28} />
              Iniciar sesión
            </button>
          </form>
        </div>

        <div className="login-right" />
      </div>

      <div className="login-footer">
        © 2026 Sistema de Alisto. Todos los derechos reservados.
      </div>
    </div>
  );
}
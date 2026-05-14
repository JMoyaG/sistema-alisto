import {
  Eye,
  PackageCheck,
  BarChart3,
  ClipboardList,
  Boxes,
  User,
  Lock,
  LogIn,
} from "lucide-react";

import "./Login.css";
import { useState } from "react";
import { validarUsuario } from "../services/ordenesApi";

type Props = {
  onLogin: (usuario: string) => void;
};

export default function Login({ onLogin }: Props) {
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

    localStorage.setItem("alisto-user", usuario);
    onLogin(usuario);
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

              <span className="login-forgot">¿Olvidaste tu contraseña?</span>
            </div>

            <button className="login-button" type="submit">
              <LogIn size={28} />
              Iniciar sesión
            </button>
          </form>
        </div>

        <div className="login-right">
          <div className="login-overlay">
            <div className="feature-row">
              <div className="feature-icon">
                <Boxes size={34} />
              </div>
              <div>
                <div className="feature-title">Gestión eficiente</div>
                <div className="feature-text">
                  Administra pedidos y entregas de manera eficiente.
                </div>
              </div>
            </div>

            <div className="feature-row">
              <div className="feature-icon">
                <ClipboardList size={34} />
              </div>
              <div>
                <div className="feature-title">Control en tiempo real</div>
                <div className="feature-text">
                  Monitorea el estado de tus pedidos en tiempo real.
                </div>
              </div>
            </div>

            <div className="feature-row">
              <div className="feature-icon">
                <BarChart3 size={34} />
              </div>
              <div>
                <div className="feature-title">Reportes y estadísticas</div>
                <div className="feature-text">
                  Obtén reportes detallados y estadísticas de tu operación.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="login-footer">
        © 2026 Sistema de Alisto. Todos los derechos reservados.
      </div>
    </div>
  );
}
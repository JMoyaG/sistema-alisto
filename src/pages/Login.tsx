import { Lock, PackageCheck, Eye } from "lucide-react";
import "./Login.css";
import { useState } from "react";
import { validarUsuario } from "../services/ordenesApi";

type Props = {
  onLogin: (usuario: string) => void;
};

export default function Login({ onLogin }: Props) {
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [recordarme, setRecordarme] = useState(true);
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  const iniciarSesion = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setCargando(true);

    try {
      const ok = await validarUsuario(usuario, password);

      if (!ok) {
        setError("Usuario o contraseña incorrectos.");
        return;
      }

      if (recordarme) {
        localStorage.setItem("alisto-user", usuario);
      } else {
        sessionStorage.setItem("alisto-user", usuario);
      }

      onLogin(usuario);
    } catch (err) {
      console.error(err);
      setError("No se pudo validar el usuario.");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">

        <div className="login-left">

          <div className="logo-box">
            <div className="logo-icon">
              <PackageCheck size={55} />
            </div>

            <h1 className="logo-title">Sistema de Alisto</h1>

            <p className="logo-subtitle">
              Gestión de Pedidos y Entregas
            </p>
          </div>

          <div className="login-divider">
            <span>Inicia sesión para continuar</span>
          </div>

          <form onSubmit={iniciarSesion}>

            <div className="login-form-group">
              <label>Usuario</label>

              <input
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                placeholder="Ingresa tu usuario"
                className="login-input"
              />
            </div>

            <div className="login-form-group">
              <label>Contraseña</label>

              <div style={{ position: "relative" }}>
                <input
                  type={mostrarPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ingresa tu contraseña"
                  className="login-input"
                />

                <button
                  type="button"
                  onClick={() =>
                    setMostrarPassword(!mostrarPassword)
                  }
                  style={{
                    position: "absolute",
                    right: 20,
                    top: "50%",
                    transform: "translateY(-50%)",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                  }}
                >
                  <Eye />
                </button>
              </div>
            </div>

            <div className="login-options">
              <label className="login-remember">
                <input
                  type="checkbox"
                  checked={recordarme}
                  onChange={(e) =>
                    setRecordarme(e.target.checked)
                  }
                />
                Recordarme
              </label>
            </div>

            {error && (
              <div
                style={{
                  background: "#fee2e2",
                  color: "#991b1b",
                  padding: 15,
                  borderRadius: 12,
                  marginTop: 20,
                  fontWeight: "bold",
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={cargando}
              className="login-button"
            >
              {cargando
                ? "Validando..."
                : "Iniciar sesión"}
            </button>
          </form>
        </div>

        <div className="login-right">
          <div className="login-overlay">

            <div className="feature-card">
              <div className="feature-title">
                Gestión eficiente
              </div>

              <div className="feature-text">
                Administra pedidos y entregas de manera eficiente.
              </div>
            </div>

            <div className="feature-card">
              <div className="feature-title">
                Control en tiempo real
              </div>

              <div className="feature-text">
                Monitorea el estado de tus pedidos en tiempo real.
              </div>
            </div>

            <div className="feature-card">
              <div className="feature-title">
                Reportes y estadísticas
              </div>

              <div className="feature-text">
                Obtén reportes detallados y estadísticas de tu operación.
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
import { Eye, PackageCheck } from "lucide-react";
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
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #eef4ef, #dfe8df)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 30,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          width: 1180,
          maxWidth: "100%",
          minHeight: 680,
          background: "white",
          borderRadius: 30,
          overflow: "hidden",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          boxShadow: "0 25px 70px rgba(0,0,0,.18)",
        }}
      >
        <div style={{ padding: 70 }}>
          <div style={{ textAlign: "center", marginBottom: 35 }}>
            <div
              style={{
                width: 110,
                height: 110,
                borderRadius: 28,
                background: "#0a7b4f",
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px",
              }}
            >
              <PackageCheck size={60} />
            </div>

            <h1 style={{ fontSize: 44, margin: 0, color: "#0d1f1b" }}>
              Sistema de Alisto
            </h1>

            <p style={{ fontSize: 20, color: "#6b7280" }}>
              Gestión de Pedidos y Entregas
            </p>
          </div>

          <div
            style={{
              textAlign: "center",
              color: "#0a7b4f",
              fontWeight: 800,
              marginBottom: 35,
            }}
          >
            Inicia sesión para continuar
          </div>

          <form onSubmit={iniciarSesion}>
            <label style={{ fontWeight: 800, fontSize: 18 }}>Usuario</label>
            <input
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              placeholder="Ingresa tu usuario"
              style={{
                width: "100%",
                height: 58,
                borderRadius: 16,
                border: "2px solid #d1d5db",
                padding: "0 18px",
                fontSize: 18,
                marginTop: 10,
                marginBottom: 25,
              }}
            />

            <label style={{ fontWeight: 800, fontSize: 18 }}>Contraseña</label>
            <div style={{ position: "relative", marginTop: 10 }}>
              <input
                type={mostrarPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ingresa tu contraseña"
                style={{
                  width: "100%",
                  height: 58,
                  borderRadius: 16,
                  border: "2px solid #d1d5db",
                  padding: "0 55px 0 18px",
                  fontSize: 18,
                }}
              />

              <button
                type="button"
                onClick={() => setMostrarPassword(!mostrarPassword)}
                style={{
                  position: "absolute",
                  right: 15,
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

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginTop: 25,
                fontSize: 17,
              }}
            >
              <input
                type="checkbox"
                checked={recordarme}
                onChange={(e) => setRecordarme(e.target.checked)}
              />
              Recordarme
            </label>

            {error && (
              <div
                style={{
                  background: "#fee2e2",
                  color: "#991b1b",
                  padding: 14,
                  borderRadius: 12,
                  marginTop: 20,
                  fontWeight: 700,
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={cargando}
              style={{
                width: "100%",
                height: 65,
                border: "none",
                borderRadius: 18,
                background: "linear-gradient(135deg, #0a7b4f, #0d9c63)",
                color: "white",
                fontSize: 22,
                fontWeight: 900,
                marginTop: 30,
                cursor: "pointer",
              }}
            >
              {cargando ? "Validando..." : "Iniciar sesión"}
            </button>
          </form>
        </div>

        <div
          style={{
            background:
              "linear-gradient(rgba(0,60,35,.78), rgba(0,60,35,.78)), url('https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=1600&auto=format&fit=crop')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            color: "white",
            padding: 70,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 30,
          }}
        >
          {[
            ["Gestión eficiente", "Administra pedidos y entregas de manera eficiente."],
            ["Control en tiempo real", "Monitorea el estado de tus pedidos en tiempo real."],
            ["Reportes y estadísticas", "Obtén reportes detallados y estadísticas de tu operación."],
          ].map(([titulo, texto]) => (
            <div
              key={titulo}
              style={{
                background: "rgba(255,255,255,.13)",
                padding: 25,
                borderRadius: 24,
              }}
            >
              <h2 style={{ margin: 0, fontSize: 26 }}>{titulo}</h2>
              <p style={{ fontSize: 18, lineHeight: 1.5 }}>{texto}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
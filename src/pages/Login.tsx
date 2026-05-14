import { Lock, LogIn, PackageCheck, User, Eye } from "lucide-react";
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
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-emerald-100 flex items-center justify-center p-6">
      <div className="w-full max-w-6xl bg-white rounded-[28px] shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-2">
        <div className="p-10 md:p-16 flex flex-col justify-center">
          <div className="text-center mb-10">
            <div className="mx-auto w-24 h-24 rounded-3xl border-4 border-emerald-700 flex items-center justify-center mb-5 relative">
              <PackageCheck className="w-14 h-14 text-emerald-700" />
            </div>

            <h1 className="text-4xl font-extrabold text-slate-900">
              Sistema de Alisto
            </h1>
            <p className="text-slate-500 mt-2">Gestión de Pedidos y Entregas</p>

            <div className="flex items-center gap-4 mt-8">
              <div className="h-px bg-slate-200 flex-1" />
              <span className="text-emerald-700 font-semibold">
                Inicia sesión para continuar
              </span>
              <div className="h-px bg-slate-200 flex-1" />
            </div>
          </div>

          <form onSubmit={iniciarSesion} className="space-y-6">
            <div>
              <label className="block font-bold text-slate-800 mb-2">
                Usuario
              </label>
              <div className="relative">
                <User className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  placeholder="Ingresa tu usuario"
                  className="w-full border border-slate-300 rounded-xl py-4 pl-12 pr-4 outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-800 mb-2">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type={mostrarPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ingresa tu contraseña"
                  className="w-full border border-slate-300 rounded-xl py-4 pl-12 pr-12 outline-none focus:ring-2 focus:ring-emerald-600"
                />
                <button
                  type="button"
                  onClick={() => setMostrarPassword(!mostrarPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500"
                >
                  <Eye className="w-5 h-5" />
                </button>
              </div>
            </div>

            <label className="flex items-center gap-3 text-slate-700">
              <input
                type="checkbox"
                checked={recordarme}
                onChange={(e) => setRecordarme(e.target.checked)}
                className="w-5 h-5 accent-emerald-700"
              />
              Recordarme
            </label>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm font-semibold">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={cargando}
              className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-4 rounded-xl shadow-lg flex items-center justify-center gap-3 disabled:opacity-60"
            >
              <LogIn className="w-5 h-5" />
              {cargando ? "Validando..." : "Iniciar sesión"}
            </button>
          </form>
        </div>

        <div className="hidden lg:flex bg-emerald-950 text-white p-14 flex-col justify-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-900 to-emerald-950 opacity-95" />
          <div className="relative space-y-10">
            <div>
              <h2 className="text-2xl font-extrabold">Gestión eficiente</h2>
              <p className="text-emerald-100 mt-2">
                Administra pedidos y entregas de manera eficiente.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-extrabold">
                Control en tiempo real
              </h2>
              <p className="text-emerald-100 mt-2">
                Monitorea el estado de tus pedidos en tiempo real.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-extrabold">
                Reportes y estadísticas
              </h2>
              <p className="text-emerald-100 mt-2">
                Obtén reportes detallados y estadísticas de tu operación.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
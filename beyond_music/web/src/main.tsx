import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { Toaster } from "sonner"
import { App } from "./App"
import "./index.css"

createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <App />
    <Toaster position="bottom-center" offset={96} toastOptions={{ className: "font-sans" }} />
  </StrictMode>
)

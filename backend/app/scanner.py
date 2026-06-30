import os
import subprocess
import logging

logger = logging.getLogger("scanner")

def scan_to_file(output_path: str) -> bool:
    """
    Dispara la digitalización física a través del diálogo estándar de Windows (WIA).
    Guarda el archivo escaneado en output_path.
    
    Retorna True si el escaneo se guardó exitosamente, 
    Lanza una excepción si ocurrió un error o si el usuario canceló el diálogo.
    """
    # Escapar las barras inclinadas invertidas en la ruta de Windows
    normalized_path = os.path.abspath(output_path).replace("\\", "\\\\")
    
    # Script inline de PowerShell para interactuar con el objeto COM de WIA
    ps_script = f"""
    $ErrorActionPreference = 'Stop'
    try {{
        # WIA.CommonDialog muestra la UI estándar de Windows para escaneo
        $dialog = New-Object -ComObject WIA.CommonDialog
        
        # Levanta el diálogo para adquirir la imagen del escáner
        # ShowAcquireImage(DeviceType, Intent, Bias, FormatID, AlwaysSelectDevice, UseCommonUI, CancelError)
        # DeviceType=1 (Scanner), Intent=0 (Unspecified), Bias=1024 (Minimize size), FormatID={{B96B3CAF-0728-11D3-9D7B-0000F81EF32E}} (PNG)
        $image = $dialog.ShowAcquireImage(1, 0, 1024, "{{B96B3CAF-0728-11D3-9D7B-0000F81EF32E}}", $false, $true, $true)
        
        if ($image) {{
            # Si el archivo destino ya existe, PowerShell lanzaría error al guardar. Lo removemos antes.
            if (Test-Path "{normalized_path}") {{
                Remove-Item "{normalized_path}" -Force
            }}
            $image.SaveFile("{normalized_path}")
            Write-Output "SUCCESS"
        }} else {{
            Write-Output "CANCELLED"
        }}
    }} catch {{
        Write-Output "ERROR: $($_.Exception.Message)"
    }}
    """
    
    try:
        # Ejecutar PowerShell con el script inline
        result = subprocess.run(
            ["powershell", "-NoProfile", "-Command", ps_script],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="ignore",
            check=True
        )
        
        stdout = result.stdout.strip()
        logger.info(f"PowerShell Scanner Output: {stdout}")
        
        if "SUCCESS" in stdout:
            if os.path.exists(output_path):
                return True
            raise Exception("El escáner informó éxito pero el archivo físico no fue creado en el disco.")
        
        if "CANCELLED" in stdout:
            raise Exception("Operación de escaneo cancelada por el usuario.")
            
        if "ERROR:" in stdout:
            err_msg = stdout.split("ERROR:")[1].strip()
            # Errores comunes de WIA: No hay dispositivo (0x80210015), Cancelado (0x8021000C)
            if "0x80210015" in err_msg or "no se encuentra disponible" in err_msg.lower():
                raise Exception("No se detectó ningún escáner conectado o encendido en el sistema.")
            if "0x8021000C" in err_msg or "canceló" in err_msg.lower():
                raise Exception("Operación de escaneo cancelada por el usuario.")
            raise Exception(f"Error nativo de Windows WIA: {err_msg}")
            
        raise Exception(f"Resultado inesperado del módulo de escaneo: {stdout}")
        
    except subprocess.CalledProcessError as e:
        logger.error(f"Error al lanzar el comando PowerShell: {e.stderr}")
        raise Exception(f"No se pudo ejecutar el subsistema de escaneo de Windows. Detalle: {e.stderr.strip()}")

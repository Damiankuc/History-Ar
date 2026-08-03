import sys
import os
import io

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../app')))

from PIL import Image, ImageDraw
from main import _remover_fondo_blanco

def test_signature_background_removal():
    print("Testing signature white background removal...")
    
    # 1. Crear una imagen de prueba de 100x100 con fondo blanco y un trazo negro (firma)
    img = Image.new("RGB", (100, 100), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.line([(10, 10), (90, 90)], fill=(0, 0, 0), width=5)  # trazo negro
    
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    jpeg_bytes = buf.getvalue()
    
    # 2. Procesar con _remover_fondo_blanco
    processed_bytes = _remover_fondo_blanco(jpeg_bytes)
    
    # 3. Verificar que la imagen resultante sea RGBA y tenga transparencia en las esquinas
    result_img = Image.open(io.BytesIO(processed_bytes))
    assert result_img.mode == "RGBA", f"Modo esperado RGBA, obtenido {result_img.mode}"
    
    # La esquina superior derecha (90, 10) debe ser blanca transparente (alpha = 0)
    r, g, b, a = result_img.getpixel((90, 10))
    assert a == 0, f"El fondo debe ser transparente (alpha=0), obtenido alpha={a}"
    
    # El centro del trazo (50, 50) debe ser negro opaco (alpha = 255)
    r_ink, g_ink, b_ink, a_ink = result_img.getpixel((50, 50))
    assert a_ink == 255, f"La tinta de la firma debe ser opaca (alpha=255), obtenido alpha={a_ink}"
    
    print("[OK] Firma procesada con éxito: Fondo blanco convertido en transparente PNG.")

if __name__ == "__main__":
    test_signature_background_removal()

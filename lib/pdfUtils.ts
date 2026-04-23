import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

export const generatePortalFlyer = async (societyName: string, portalUrl: string, lang: 'it' | 'en' = 'it') => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const texts = {
    it: {
      portal: "PORTALE RISULTATI ONLINE",
      scan: "Scansiona il QR Code per visualizzare",
      realtime: "i risultati e le classifiche in tempo reale",
      direct: "Link diretto:",
      footer: "Sviluppato da Clay Performance - www.clay-performance.it"
    },
    en: {
      portal: "ONLINE RESULTS PORTAL",
      scan: "Scan the QR Code to view",
      realtime: "real-time results and rankings",
      direct: "Direct link:",
      footer: "Powered by Clay Performance - www.clay-performance.it"
    }
  }[lang];

  // Background color (White for printer-friendliness)
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, 210, 297, 'F');

  // Branding bar at top
  doc.setFillColor(15, 23, 42); // slate-950
  doc.rect(0, 0, 210, 40, 'F');

  // Decorative orange accent
  doc.setFillColor(234, 88, 12); // orange-600
  doc.rect(0, 38, 210, 2, 'F');

  // Logo
  const logoUrl = "https://placehold.jp/ea580c/ffffff/180x180.png?text=%E2%A6%BF&css=%7B%22font-size%22%3A%22140px%22%7D";
  
  try {
    const img = new Image();
    img.src = logoUrl;
    img.crossOrigin = "Anonymous";
    await new Promise((resolve) => {
      img.onload = resolve;
      img.onerror = resolve;
    });
    if (img.complete && img.naturalWidth > 0) {
        doc.addImage(img, 'PNG', 15, 8, 24, 24);
    }
  } catch (e) {
    console.error("Could not load logo for PDF", e);
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("CLAY PERFORMANCE", 45, 25);
  
  // Content Section
  doc.setTextColor(15, 23, 42); // slate-950
  doc.setFontSize(28);
  doc.text(societyName.toUpperCase(), 105, 70, { align: 'center' });

  doc.setFontSize(16);
  doc.setTextColor(234, 88, 12); // orange-600
  doc.text(texts.portal, 105, 85, { align: 'center' });

  doc.setTextColor(71, 85, 105); // slate-600
  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.text(texts.scan, 105, 110, { align: 'center' });
  doc.text(texts.realtime, 105, 118, { align: 'center' });

  // QR Code box
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.5);
  doc.roundedRect(45, 130, 120, 120, 5, 5, 'D');

  // QR Code
  try {
    const qrDataUrl = await QRCode.toDataURL(portalUrl, {
      margin: 1,
      width: 400,
      color: {
        dark: '#0f172a', // slate-950
        light: '#ffffff'
      }
    });
    doc.addImage(qrDataUrl, 'PNG', 50, 135, 110, 110);
  } catch (err) {
    console.error(err);
  }

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(texts.direct, 105, 265, { align: 'center' });
  doc.setTextColor(234, 88, 12);
  doc.setFontSize(14);
  doc.text(portalUrl.replace('https://', '').replace('http://', ''), 105, 275, { align: 'center' });

  doc.setTextColor(148, 163, 184); // slate-400
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(texts.footer, 105, 290, { align: 'center' });

  return doc;
};

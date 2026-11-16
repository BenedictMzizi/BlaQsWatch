
export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="app-footer">
      © {currentYear} BlaQsWatch · Inventory Management System · Benedict de Almeida Mzizi. All rights reserved.
    </footer>
  );
}

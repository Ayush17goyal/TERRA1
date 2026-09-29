const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../../src/App.tsx');
try {
  let content = fs.readFileSync(filePath, 'utf8');
  console.log('Original content length:', content.length);

  // 1. Insert the import for ContractPopup
  const importTarget = "import LandingPageV2 from './LandingPage'";
  if (content.includes(importTarget)) {
    const importReplacement = `${importTarget}\nimport ContractPopup from './components/ContractPopup'`;
    content = content.replace(importTarget, importReplacement);
    console.log('ContractPopup import added successfully.');
  } else {
    console.log('Warning: Import target not found');
  }

  // 2. Insert the <ContractPopup /> rendering inside return in App()
  const returnTarget = '<div className="app-shell">';
  if (content.includes(returnTarget)) {
    const returnReplacement = `${returnTarget}\n      <ContractPopup />`;
    content = content.replace(returnTarget, returnReplacement);
    console.log('ContractPopup component added to app-shell return successfully.');
  } else {
    console.log('Warning: return target not found');
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('App.tsx written successfully.');
} catch (err) {
  console.error(err);
}

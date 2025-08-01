(() => {
  "use strict";

  // Constants
  const MAX_HISTORY = 50;
  const MESSAGE_TIMEOUT = 3000;
  let FILE_NAME = "vehicles.json";
  const MSG_TYPES = { ERROR: "error", SUCCESS: "success" };

  // State
  let jsonData = { vehicles: [] };
  let history = [];
  let future = [];
  // Track collapse state by vehicle index
  let collapsedMap = new Map();

  // Cached DOM elements
  const editor = document.getElementById("editor");
  const messages = document.getElementById("messages");
  const dropZone = document.getElementById("dropZone");
  const preview = document.getElementById("jsonPreview").querySelector("code");
  const filenameInput = document.getElementById("filenameInput");
  const searchInput = document.getElementById("searchInput");
  const manufacturerList = document.getElementById("manufacturerList");
  const modelList = document.getElementById("modelList");
  const engineList = document.getElementById("engineList");
  const transmissionList = document.getElementById("transmissionList");
  const undoButton = document.getElementById("undoButton");
  const redoButton = document.getElementById("redoButton");
  const addVehicleButton = document.getElementById("addVehicle");
  const downloadButton = document.getElementById("downloadButton");
  const loadButton = document.getElementById("loadButton");
  const fileInput = document.getElementById("fileInput");
  const darkModeButton = document.getElementById("toggleDarkMode");

  // Utility: debounce function to limit rate of calls
  function debounce(fn, delay) {
    let timer = null;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  // Utility: sanitize text for safe display
  function sanitizeHTML(str) {
    return str.replace(/[&<>"'`=\/]/g, c =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
        "`": "&#96;",
        "=": "&#61;",
        "/": "&#47;"
      })[c]);
  }

  // Show a temporary message
  function showMessage(msg, type = MSG_TYPES.SUCCESS) {
    messages.textContent = msg;
    messages.className = type;
    setTimeout(() => {
      messages.textContent = "";
      messages.className = "";
    }, MESSAGE_TIMEOUT);
  }

  // Save current jsonData to history with limit
  function saveHistory() {
    // Don't save duplicate states consecutively
    if (history.length > 0 && JSON.stringify(jsonData) === history[history.length - 1]) {
      return;
    }
    history.push(JSON.stringify(jsonData));
    if (history.length > MAX_HISTORY) {
      history.shift(); // Remove oldest
    }
    future = []; // Clear redo stack on new change
    updateUndoRedoButtons();
  }

  // Undo action
  function undo() {
    if (history.length === 0) return;
    future.push(JSON.stringify(jsonData));
    const prev = history.pop();
    jsonData = JSON.parse(prev);
    renderEditor();
    updateUndoRedoButtons();
  }

  // Redo action
  function redo() {
    if (future.length === 0) return;
    history.push(JSON.stringify(jsonData));
    const next = future.pop();
    jsonData = JSON.parse(next);
    renderEditor();
    updateUndoRedoButtons();
  }

  // Enable/disable undo/redo buttons
  function updateUndoRedoButtons() {
    undoButton.disabled = history.length === 0;
    redoButton.disabled = future.length === 0;
  }

  // Sort each vehicle's roster by start_number ascending
  function sortRosterEntries() {
    jsonData.vehicles.forEach(vehicle => {
      if (Array.isArray(vehicle.roster)) {
        vehicle.roster.sort(
          (a, b) =>
            (a.fleet_selection?.start_number || 0) - (b.fleet_selection?.start_number || 0)
        );
      }
    });
  }

  // Collect unique autocomplete values from current jsonData
  function collectAutocomplete() {
    const manufacturers = new Set();
    const models = new Set();
    const engines = new Set();
    const transmissions = new Set();

    jsonData.vehicles.forEach(v => {
      if (v.manufacturer) manufacturers.add(v.manufacturer);
      if (v.model) models.add(v.model);
      (v.roster || []).forEach(r => {
        if (r.engine) engines.add(r.engine);
        if (r.transmission) transmissions.add(r.transmission);
      });
    });

    // Helper to populate datalist
    function populateList(element, values) {
      element.innerHTML = "";
      [...values].sort().forEach(val => {
        const opt = document.createElement("option");
        opt.value = val;
        element.appendChild(opt);
      });
    }

    populateList(manufacturerList, manufacturers);
    populateList(modelList, models);
    populateList(engineList, engines);
    populateList(transmissionList, transmissions);
  }

  // Validation helper for inputs: add/remove invalid class
  function validateField(input, condition) {
    if (!condition) input.classList.add("invalid");
    else input.classList.remove("invalid");
  }

  // Filter vehicles based on search term (case-insensitive)
  function filterVehicles(vehicle) {
    const term = searchInput.value.trim().toLowerCase();
    if (!term) return true;
    if (vehicle.manufacturer.toLowerCase().includes(term)) return true;
    if (vehicle.model.toLowerCase().includes(term)) return true;
    if (
      vehicle.roster.some(entry =>
        [entry.fleet_selection?.start_number, entry.fleet_selection?.end_number]
          .some(num => num !== undefined && num.toString().includes(term))
      )
    )
      return true;
    return false;
  }

  function setFilename() {
    const output = filenameInput.value.trim();
    if (!output) return true;
  }

  // Escape and syntax highlight JSON text for preview
  function syntaxHighlight(json) {
    // escape HTML special chars
    json = sanitizeHTML(json);
    return json.replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      match => {
        let cls = "number";
        if (/^"/.test(match)) {
          cls = /:$/.test(match) ? "key" : "string";
        } else if (/true|false/.test(match)) {
          cls = "boolean";
        } else if (/null/.test(match)) {
          cls = "null";
        }
        return `<span class="${cls}">${match}</span>`;
      }
    );
  }

  // Update JSON preview with comment header and syntax highlight
  const updatePreview = debounce(() => {
    sortRosterEntries();
    collectAutocomplete();

    const jsonString = JSON.stringify(jsonData, null, 2);

    preview.innerHTML = syntaxHighlight(jsonString).replace(/\n/g, "<br>");
  }, 300);

  // Render the editor UI
  function renderEditor() {
    editor.innerHTML = "";

    jsonData.vehicles.forEach((vehicle, vIndex) => {
      if (!filterVehicles(vehicle)) return;

      // Vehicle container
      const vDiv = document.createElement("div");
      vDiv.className = "vehicle";
      if (collapsedMap.get(vIndex)) vDiv.classList.add("collapsed");

      // Toggle collapse button
      const toggleBtn = document.createElement("button");
      toggleBtn.className = "toggleCollapse";
      toggleBtn.textContent = collapsedMap.get(vIndex) ? "[+]" : "[–]";
      toggleBtn.onclick = () => {
        const isCollapsed = collapsedMap.get(vIndex);
        collapsedMap.set(vIndex, !isCollapsed);
        renderEditor();
      };
      vDiv.appendChild(toggleBtn);

      // Title
      const title = document.createElement("h2");
      title.textContent = `Vehicle ${vIndex + 1}`;
      vDiv.appendChild(title);

      // Manufacturer input with autocomplete
      const manu = document.createElement("input");
      manu.type = "text";
      manu.setAttribute("list", "manufacturerList");
      manu.value = vehicle.manufacturer || "";
      manu.placeholder = "Manufacturer";
      manu.oninput = () => {
        vehicle.manufacturer = manu.value;
        validateField(manu, manu.value.trim() !== "");
        debouncedSaveAndPreview();
      };
      validateField(manu, manu.value.trim() !== "");
      vDiv.appendChild(manu);

      // Model input with autocomplete
      const model = document.createElement("input");
      model.type = "text";
      model.setAttribute("list", "modelList");
      model.value = vehicle.model || "";
      model.placeholder = "Model";
      model.oninput = () => {
        vehicle.model = model.value;
        validateField(model, model.value.trim() !== "");
        debouncedSaveAndPreview();
      };
      validateField(model, model.value.trim() !== "");
      vDiv.appendChild(model);

      // Delete vehicle button
      const delVehicle = document.createElement("button");
      delVehicle.textContent = "Delete Vehicle";
      delVehicle.onclick = () => {
        saveHistory();
        jsonData.vehicles.splice(vIndex, 1);
        collapsedMap.delete(vIndex);
        renderEditor();
      };
      vDiv.appendChild(delVehicle);

      // Roster title
      const rosterTitle = document.createElement("h3");
      rosterTitle.textContent = "Roster";
      vDiv.appendChild(rosterTitle);

      (vehicle.roster || []).forEach((entry, rIndex) => {
        const rDiv = document.createElement("div");
        rDiv.className = "roster";

        // Start number input
        const start = document.createElement("input");
        start.type = "number";
        start.value = entry.fleet_selection?.start_number ?? 0;
        start.placeholder = "Start #";
        start.oninput = () => {
          entry.fleet_selection.start_number = Number(start.value);
          validateField(start, !isNaN(start.value) && start.value !== "");
          debouncedSaveAndPreview();
        };
        validateField(start, !isNaN(start.value) && start.value !== "");
        rDiv.appendChild(start);

        // End number input
        const end = document.createElement("input");
        end.type = "number";
        end.value = entry.fleet_selection?.end_number ?? 0;
        end.placeholder = "End #";
        end.oninput = () => {
          entry.fleet_selection.end_number = Number(end.value);
          validateField(end, !isNaN(end.value) && end.value !== "");
          debouncedSaveAndPreview();
        };
        validateField(end, !isNaN(end.value) && end.value !== "");
        rDiv.appendChild(end);

        // Engine input with autocomplete
        const engine = document.createElement("input");
        engine.type = "text";
        engine.setAttribute("list", "engineList");
        engine.value = entry.engine || "";
        engine.placeholder = "Engine";
        engine.oninput = () => {
          entry.engine = engine.value;
          debouncedSaveAndPreview();
        };
        rDiv.appendChild(engine);

        // Transmission input with autocomplete
        const transmission = document.createElement("input");
        transmission.type = "text";
        transmission.setAttribute("list", "transmissionList");
        transmission.value = entry.transmission || "";
        transmission.placeholder = "Transmission";
        transmission.oninput = () => {
          entry.transmission = transmission.value;
          debouncedSaveAndPreview();
        };
        rDiv.appendChild(transmission);

        // Years input (comma separated)
        const years = document.createElement("input");
        years.type = "text";
        years.value = Array.isArray(entry.years) ? entry.years.join(", ") : "";
        years.placeholder = "Years (comma separated)";
        years.oninput = () => {
          entry.years = years.value
            .split(",")
            .map(y => Number(y.trim()))
            .filter(y => !isNaN(y));
          validateField(years, entry.years.length > 0);
          debouncedSaveAndPreview();
        };
        validateField(years, entry.years.length > 0);
        rDiv.appendChild(years);

        // Notes input
        const notes = document.createElement("input");
        notes.type = "text";
        notes.value = entry.notes || "";
        notes.placeholder = "Notes";
        notes.oninput = () => {
          entry.notes = notes.value;
          debouncedSaveAndPreview();
        };
        rDiv.appendChild(notes);

        // Delete roster entry button
        const delRoster = document.createElement("button");
        delRoster.textContent = "Delete Roster Entry";
        const entryRef = entry;
	delRoster.addEventListener("click", () => {
		saveHistory();
		vehicle.roster = vehicle.roster.filter(e => e !== entryRef);
		renderEditor();
	});

        rDiv.appendChild(delRoster);

        vDiv.appendChild(rDiv);
      });

      // Add roster entry button
      const addRoster = document.createElement("button");
      addRoster.textContent = "Add Roster Entry";
      addRoster.onclick = () => {
        saveHistory();
        if (!Array.isArray(vehicle.roster)) vehicle.roster = [];
        vehicle.roster.push({
          fleet_selection: { start_number: 0, end_number: 0, use_numeric_sorting: true },
          engine: "",
          transmission: "",
          years: [],
          notes: ""
        });
        renderEditor();
      };
      vDiv.appendChild(addRoster);

      editor.appendChild(vDiv);
    });

    updatePreview();
  }

  // Debounced helper for saving history and updating preview
  const debouncedSaveAndPreview = debounce(() => {
    saveHistory();
    updatePreview();
  }, 400);

  // Load JSON data from string (no comments allowed)
  function loadJSONFromText(text) {
    try {
      const parsed = JSON.parse(text);
      if (!parsed.vehicles || !Array.isArray(parsed.vehicles))
        throw new Error("Missing or invalid 'vehicles' array");
      jsonData = parsed;
      history = [];
      future = [];
      setFilename();
      collapsedMap.clear();
      renderEditor();
      showMessage("JSON loaded successfully", MSG_TYPES.SUCCESS);
    } catch (e) {
      showMessage("Invalid JSON file: " + e.message, MSG_TYPES.ERROR);
    }
  }

  // File validation helper: allow only .json files
  function isValidJsonFile(file) {
    return file && file.name.toLowerCase().endsWith(".json");
  }

  // Setup drag and drop event handlers
  function setupDragAndDrop() {
    document.addEventListener("dragover", e => {
      e.preventDefault();
      dropZone.style.display = "flex";
    });
    document.addEventListener("dragleave", e => {
      if (e.target === dropZone || e.pageX === 0) {
        dropZone.style.display = "none";
      }
    });
    document.addEventListener("drop", e => {
      e.preventDefault();
      dropZone.style.display = "none";
      if (e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (!isValidJsonFile(file)) {
          showMessage("Please drop a valid .json file", MSG_TYPES.ERROR);
          return;
        }
        const reader = new FileReader();
        reader.onload = ev => loadJSONFromText(ev.target.result);
        reader.readAsText(file);
      }
    });
  }

  // Button event handlers
  undoButton.addEventListener("click", undo);
  redoButton.addEventListener("click", redo);

  addVehicleButton.addEventListener("click", () => {
    saveHistory();
    jsonData.vehicles.push({ manufacturer: "", model: "", roster: [] });
    renderEditor();
  });

  downloadButton.addEventListener("click", () => {
    const content = JSON.stringify(jsonData, null, 2);
    const blob = new Blob([content], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = FILE_NAME;
    a.click();
    showMessage("JSON file downloaded", MSG_TYPES.SUCCESS);
  });

  loadButton.addEventListener("click", () => {
    const file = fileInput.files[0];
    if (!isValidJsonFile(file)) {
      showMessage("Please choose a valid JSON file", MSG_TYPES.ERROR);
      return;
    }
    FILE_NAME = file.name;
    const reader = new FileReader();
    reader.onload = e => loadJSONFromText(e.target.result);
    reader.readAsText(file);
  });

  darkModeButton.addEventListener("click", () => {
    document.body.classList.toggle("dark");
  });

  searchInput.addEventListener("input", () => {
    renderEditor();
  });

  filenameInput.addEventListener("input", () => {
    setFilename();  
  });

  // Keyboard shortcuts for Undo/Redo
  document.addEventListener("keydown", e => {
    const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
    const ctrl = isMac ? e.metaKey : e.ctrlKey;
    if (ctrl && e.key.toLowerCase() === "z") {
      e.preventDefault();
      undo();
    }
    if (ctrl && e.key.toLowerCase() === "y") {
      e.preventDefault();
      redo();
    }
  });

  // Initialize drag-and-drop listeners
  setupDragAndDrop();

  // Initial render and setup
  updateUndoRedoButtons();
  renderEditor();
})();



// command stack
let transientCommand = null;
let commands = [];
let undos = [];
let nextId = 1;

// tools
let currentTool = "";
let dragStart = null;
let dragTarget = -1;

// canvas
let context = null;
let elementsById = null;

const init = () => {

  // add listeners to palette
  const nodes = document.querySelectorAll(".palette-item");
  nodes.forEach(node => {
  switch (node.id) {
      case "undo":
        node.onclick = handleUndoClick;
        break;
      case "redo":
        node.onclick = handleRedoClick;
        break;
      case "new":
        node.onclick = handleNewClick;
        break;
      default:
        node.onclick = handleToolClick;
        break;
    }
  });

  // add listeners to canvas
  const canvas = document.getElementById("canvas");
  canvas.onmousedown = handleCanvasMouseDown;
  canvas.onmousemove = handleCanvasMouseMove;
  canvas.onmouseup = handleCanvasMouseUp;
  context = canvas.getContext("2d");

  // select line tool by default
  selectTool("line");

  // render canvas
  updateButtonsForCurrentState();
  renderCommandsToElements();
}

const selectTool = (tool) => {
  if (currentTool === tool) {
    return;
  }
  if (currentTool != "") {
    document.getElementById(currentTool).className = "palette-item"; 
  }
  document.getElementById(tool).className = "palette-item highlight";
  currentTool = tool;
}

const updateButtonsForCurrentState = () => {
  document.getElementById("undo").disabled = commands.length === 0;
  document.getElementById("redo").disabled = undos.length === 0;
}

const addDeleteCommand = (id, isTransient) => {
  addCommand({tool: "delete", id}, isTransient);
}

const addMoveCommand = (id, offset, isTransient) => {
  addCommand({tool: "move", id, offset}, isTransient);
}

const addDrawCommand = (tool, rect, isTransient) => {
  addCommand({tool, id: nextId, rect}, isTransient);
}

const addCommand = (command, isTransient) => {
  if (isTransient) {
    transientCommand = command;
  } else {
    transientCommand = {};
    commands.push(command);
    undos = [];
    nextId++;
  }
  updateButtonsForCurrentState();
  renderCommandsToElements();
}

const renderCommandsToElements = () => {

  // reset elements
  elementsById = {};

  // process command stack
  const allCommands = transientCommand != null ? [...commands, transientCommand] : commands;
  allCommands.forEach(command => {
    switch (command.tool) {
      case "delete":
        delete elementsById[command.id];
        break;
      case "move":
        elementsById[command.id].rect.x += command.offset.x;
        elementsById[command.id].rect.y += command.offset.y;
        break;
      default:
        elementsById[command.id] = {shape: command.tool, rect: {...command.rect}};
        break;
    }
  });

  // clear canvas
  context.fillStyle = 'white';
  context.fillRect(0, 0, canvas.width, canvas.height);

  // render elements
  for (let id in elementsById) {
    let element = elementsById[id];
    let rect = element.rect;
    switch (element.shape) {
      case "line":
        context.beginPath();
        context.moveTo(rect.x, rect.y);
        context.lineTo(rect.x + rect.width, rect.y + rect.height);
        context.stroke();
        break;
      case "rect":
        context.fillRect(rect.x, rect.y, rect.width, rect.height);
        context.strokeRect(rect.x, rect.y, rect.width, rect.height);
        break;
      case "ellipse":
        context.beginPath();
        context.ellipse(
          rect.x + rect.width * 0.5, 
          rect.y + rect.height * 0.5, 
          Math.abs(rect.width) * 0.5,
          Math.abs(rect.height) * 0.5, 
          0, 0, Math.PI * 2);
        context.fill();
        context.stroke();
        break;
    }
  };
}

const hitTest = (p) => {
  const keys = Object.keys(elementsById);
  for (let i = keys.length - 1; i >= 0; i--) {
    const id = keys[i];
    const element = elementsById[id];
    const rect = element.rect;
    let hit = false;
    switch (element.shape) {
      case "line":
        hit = distanceToSegmentSquared(p, rect) < 4;
        break;
      case "rect":
        hit = rectContainsPoint(p, rect);
        break;
      case "ellipse":
        hit = ellipseContainsPoint(p, rect);
        break;
    }
    if (hit) {
      return id;
    }
  }
  return null;
}

const distanceToSegmentSquared = (p, rect) => {
  const v = {x: rect.x, y: rect.y};
  const w = {x: rect.x + rect.width, y: rect.y + rect.height};
  const l2 = distanceSquared(v, w);
  if (l2 === 0) {
    return distanceSquared(p, v);
  }
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return distanceSquared(p, {x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y)});
}

const distanceSquared = (v, w) => {
  return Math.pow(v.x - w.x, 2) + Math.pow(v.y - w.y, 2);
}

const rectContainsPoint = (p, rect) => {
  const minX = Math.min(rect.x, rect.x + rect.width);
  const maxX = Math.max(rect.x, rect.x + rect.width);
  const minY = Math.min(rect.y, rect.y + rect.height);
  const maxY = Math.max(rect.y, rect.y + rect.height);
  return (p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY);
}

const ellipseContainsPoint = (p, rect) => {
  const center = {x: rect.x + rect.width * 0.5, y: rect.y + rect.height * 0.5};
  const radius = {x: Math.abs(rect.width) * 0.5, y: Math.abs(rect.height) * 0.5};
  return Math.pow(p.x - center.x, 2) / Math.pow(radius.x, 2) + Math.pow(p.y - center.y, 2) / Math.pow(radius.y, 2) <= 1;
}

const handleUndoClick = (e) => {
  if (commands.length) {
    undos.push(commands.pop());
    updateButtonsForCurrentState();
    renderCommandsToElements();
  }
}

const handleRedoClick = (e) => {
  if (undos.length) {
    commands.push(undos.pop());
    updateButtonsForCurrentState();
    renderCommandsToElements();
  }
}

const handleNewClick = (e) => {
  commands = [];
  undos = [];
  transient = null;
  updateButtonsForCurrentState();
  renderCommandsToElements();
}

const handleToolClick = (e) => {
  selectTool(e.currentTarget.id);
}

const handleCanvasMouseDown = (e) => {
  dragStart = {x: e.layerX, y: e.layerY};
  switch (currentTool) {
    case "delete":
    case "move":
      dragTarget = hitTest(dragStart);
      break;
  }
}

const handleCanvasMouseMove = (e) => {
  switch (currentTool) {
    case "move":
      if (dragStart != null && dragTarget != null) {
        addMoveCommand(dragTarget, {x: e.layerX - dragStart.x, y: e.layerY - dragStart.y}, true);  
      }
      break;
    case "line":
    case "rect":
    case "ellipse":
      if (dragStart != null) {
        addDrawCommand(currentTool, {...dragStart, width: e.layerX - dragStart.x, height: e.layerY - dragStart.y}, true);  
      }
      break;
  }
}

const handleCanvasMouseUp = (e) => {
  switch (currentTool) {
    case "delete": {
      let target = hitTest({x: e.layerX, y: e.layerY});
      if (target === dragTarget) {
        addDeleteCommand(target);  
      }
      break;
    }
    case "move":
      if (dragStart != null && dragTarget != null) {
        addMoveCommand(dragTarget, {x: e.layerX - dragStart.x, y: e.layerY - dragStart.y});  
      }
      break;
    case "line":
    case "rect":
    case "ellipse":
      if (dragStart != null) {
        addDrawCommand(currentTool, {...dragStart, width: e.layerX - dragStart.x, height: e.layerY - dragStart.y});
      }
      break;
  }
  dragStart = null;
  dragTarget = null;
}

window.onload = function() {
  init();
}

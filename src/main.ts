import "./style.css";

const APP_NAME = "Cash Grab";
const app = document.querySelector<HTMLDivElement>("#app")!;
const header = document.createElement("h1");

document.title = APP_NAME;
//app.innerHTML = APP_NAME; test
header.innerHTML = APP_NAME;
app.append(header);

const tmpButton = document.createElement("button");
tmpButton.innerHTML = "this is a temp button";
app.append(tmpButton);

tmpButton.addEventListener("click", () => {
  alert("you clicked the button!");
});

export const THEME_KEY = "eigenx-theme";

export const themeInitScript = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(t!=="light"&&t!=="dark"){t="dark"}var d=document.documentElement;if(t==="dark"){d.classList.add("dark")}else{d.classList.remove("dark")}d.style.colorScheme=t}catch(e){document.documentElement.classList.add("dark")}})();`;
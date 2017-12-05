const widgetItems = document.getElementsByClassName("widgets__item"), // Widget word cloud
widgets = document.getElementsByClassName("widget"); // Widgets' bodies

let activeWidgetItem = document.getElementsByClassName("widgets__item_active")[0];

for(let i = 0; i < widgetItems.length; i++) {
    widgetItems[i].addEventListener("click", e => { // Add click event for each widget button in the cloud
        const targetWidget = document.getElementById(e.target.dataset.widgetTarget), // Defines which widget the user is trying to render
        openedWidget = document.getElementsByClassName("widget_open")[0]; // Defines the current open widget

        targetWidget.classList.add("widget_opening"); // Starts the process of opening the next widget

        openedWidget.classList.remove("widget_open"); // Removes the active state of the current widget
        openedWidget.classList.add("widget_closing"); // But guarantees the current active widget a closing class for transition purposes

        activeWidgetItem.classList.remove("widgets__item_active"); // Removes the active state of the current widget item in the cloud
        activeWidgetItem = e.target; // Sets the new active widget item as the clicked one
        activeWidgetItem.classList.add("widgets__item_active"); // And adds the active CSS class to it
        

        setTimeout(() => {
            targetWidget.classList.remove("widget_opening"); // Removes the opening class to finish transition
            targetWidget.classList.add("widget_open"); // Defines the new target widget
            openedWidget.classList.remove("widget_closing"); // Finally gets completely rid of the previously openened widget

        },200) // When the transition is done, finish the process by attributing the final classes to each widget
    })
}
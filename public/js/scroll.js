
document.addEventListener("DOMContentLoaded", () => {
    const containerColumns = document.querySelector(".container-columns");
    const columnsBody = document.querySelectorAll(".column-body");

    function enableDragScroll(element, direction) {
        let isDragging = false;
        let startPosition = 0;
        let scrollPosition = 0;

        element.style.cursor = "grab";

        element.addEventListener("mousedown", (e) => {
       
            if (e.target.closest("button, a, input, textarea, select")) return;

            isDragging = true;

            startPosition = direction === "x" ? e.pageX : e.pageY;
            scrollPosition = direction === "x"
                ? element.scrollLeft
                : element.scrollTop;

            element.style.cursor = "grabbing";
        });

        element.addEventListener("mousemove", (e) => {
            if (!isDragging) return;

            e.preventDefault();

            const currentPosition = direction === "x" ? e.pageX : e.pageY;
            const distance = currentPosition - startPosition;

            if (direction === "x") {
                element.scrollLeft = scrollPosition - distance;
            } else {
                element.scrollTop = scrollPosition - distance;
            }
        });

        document.addEventListener("mouseup", () => {
            isDragging = false;
            element.style.cursor = "grab";
        });
    }

    enableDragScroll(containerColumns, "x");

    columnsBody.forEach((column) => {
        enableDragScroll(column, "y");
    });
});

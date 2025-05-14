function initDynamicUIElements() {
    const mainColorInput = document.getElementById('brickColor');
    const modalColorInput = document.getElementById('modalBrickColor');
    
    if (mainColorInput && modalColorInput) {
        mainColorInput.addEventListener('change', function() {
            modalColorInput.value = this.value;
            brickColor = parseInt(this.value.substring(1), 16);
            updateStampBaseColor();
        });
        
        document.getElementById('configBtn').addEventListener('click', function() {
            modalColorInput.value = mainColorInput.value;
        });
    }

    const accordionHeaderSvg = document.querySelector('.accordion-header-svg');
    if (accordionHeaderSvg) {
        const accordionContentSvg = accordionHeaderSvg.nextElementSibling;

        if (accordionContentSvg && !accordionHeaderSvg.classList.contains('active')) {
            accordionContentSvg.style.maxHeight = "0px";
        }

        accordionHeaderSvg.addEventListener('click', function() {
            this.classList.toggle('active');
            this.setAttribute('aria-expanded', this.classList.contains('active'));

            if (accordionContentSvg) {
                if (accordionContentSvg.style.maxHeight && accordionContentSvg.style.maxHeight !== "0px") {
                    accordionContentSvg.style.maxHeight = "0px";
                } else {
                    accordionContentSvg.style.maxHeight = accordionContentSvg.scrollHeight + "px";
                }
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', function() {
    initDynamicUIElements();
});

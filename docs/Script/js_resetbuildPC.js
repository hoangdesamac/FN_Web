Selection// JS RESET BUILD PC - CHỈ LOAD HEADER & FOOTER

async function loadPagePart(url, containerId, callback = null) {
    try {
        const response = await fetch(url);
        const html = await response.text();
        $(`#${containerId}`).html(html);

        const $tempDiv = $('<div>').html(html);
        $tempDiv.find('script').each(function () {
            const src = $(this).attr('src');
            if (src && $(`script[src="${src}"]`).length) return;
            const $newScript = $('<script>');
            if (src) $newScript.attr('src', src);
            else $newScript.text($(this).text());
            $('body').append($newScript);
        });

        if (typeof callback === 'function') callback();
    } catch (error) {
        console.error(`Lỗi khi tải ${url}:`, error);
    }
}

$(function() {
    // Load header và footer cho trang build PC
    loadPagePart("HTML/Layout/resetheader.html", "header-container", () => {
        if (typeof initHeader === 'function') initHeader();
    });
    loadPagePart("HTML/Layout/resetfooter.html", "footer-container");
});

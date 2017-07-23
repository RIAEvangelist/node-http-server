$(function() {
    $.jstree.defaults.search.case_sensitive = true;
    $.jstree.defaults.search.show_only_matches_children = true;
    $.jstree.defaults.search.show_only_matches = true;
    var to;
    var jsTreeData = JSON.parse($('#jsTreeJSON').text().trim());
    var $tree = $('nav.navigationTree > div').jstree({
        core: {
            data: jsTreeData,
            themes: {
                name: 'default-dark'
            }
        },
        plugins: [
            'search'
        ]
    });
    // bind events to open page
    $tree.on('changed.jstree', function(e, data) {
        if (!data.node) {
            return;
        }
        if (data.node.icon === 'jstree-file') {
            window.location.href = data.node.a_attr.href;
        } else {
            $tree.jstree('open_node', data.node);
        }
    });

    // open the selected node parent
    var leafNode = window.location.href.split('/').pop();
    $tree.on('ready.jstree', function() {
        $tree.jstree('select_node', leafNode, true);
    });

    $('.navigatorToggle').on('click', function(e) {
        e.stopPropagation();
        var nav = $('nav.navigationTree');
        if (nav.hasClass('minimized')) {
            nav.removeClass('minimized');
            $('nav.navigationTree').on('click.navigator', function(e) {
                e.stopPropagation();
            });
            $('body').on('click.navigator', function(e) {
                nav.addClass('minimized');
            });
        } else {
            $('nav.navigationTree').off('click.navigator');
            $('body').off('click.navigator');
            nav.addClass('minimized');
        }
    });
    $('#jsTreeSearch').keyup(function() {
        if (to) {
            clearTimeout(to);
        }
        to = setTimeout(function() {
            var v = $('#jsTreeSearch').val();
            $('nav.navigationTree > div').jstree(true).search(v);
        }, 250);
    });

});

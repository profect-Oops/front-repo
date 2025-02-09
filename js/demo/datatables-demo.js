// Call the dataTables jQuery plugin
$(document).ready(function() {
  $('#dataTable').DataTable({
      "pageLength": 5,
      "lengthMenu": [5, 10],
      "language": {
          "info": "_START_-_END_개 표시",
          "infoEmpty": "데이터 없음"
      }
  });
});
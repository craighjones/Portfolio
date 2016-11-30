$(document).ready(function($){
	
    $(window).on('load resize', function () {
	    
         if ($(window).width() < 768 ) {
		 	
			var $window = $(window),
			$content = $('#home .inner');
			$content.height($window.height()/2);

         }else{
	         
			var $window = $(window),
			$content = $('#home .inner');
			$content.height($window.height());

         }
     });
	
	// accordion start ***************************
	$('#project #accordion li.active .content').slideDown();
	$('#project #accordion li .content').not('#project #accordion li.active .content').slideUp();

	$('#project #accordion .opner').click(function(){
		$(this).parent('li').toggleClass('active');		
		$('#project #accordion li.active .content').slideDown();
		$('#project #accordion li .content').not('#project #accordion li.active .content').slideUp();
		return false;		
	});
});

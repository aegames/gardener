require 'nokogiri'
require 'reverse_markdown'

doc = Nokogiri::HTML.parse(File.read('scene-intros.html'))
doc.css('section').each do |section|
  title = section.css('h1').text
  year = section.css('h2').text
  content = section.css('article').inner_html
  content.gsub!(/\u00A0/, ' ')
  content.gsub!(/\&nbsp;/, ' ')
  content.gsub!(/ +/, ' ')

  File.open("scene-intros/#{title}.md", 'w') do |f|
    f.write("**Year: #{year}**\n\n")
    f.write ReverseMarkdown.convert(content)
  end
end
